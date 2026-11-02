using System.Linq.Expressions;
using System.Globalization;
using System.Text.RegularExpressions;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/student-dues-assistant")]
[Authorize]
public sealed class StudentDuesAssistantController : ControllerBase
{
    private static readonly HashSet<string> QueryWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "a", "an", "and", "are", "bataye", "balance", "baki", "baaki", "bakaya", "bataiye",
        "batao", "du", "due", "dues", "fees", "fee", "hai", "hain", "how",
        "ka", "ke", "kitna", "kitne", "ki", "kya", "much", "of", "outstanding", "please", "student",
        "the", "total", "what", "कितना", "कितने", "कितनी", "का", "की", "के", "है", "हैं", "बाकी",
        "बकाया", "बताइए", "बताओ"
    };
    private static readonly IReadOnlyDictionary<char, string> HindiConsonants = new Dictionary<char, string>
    {
        ['क'] = "k", ['ख'] = "kh", ['ग'] = "g", ['घ'] = "gh", ['ङ'] = "ng",
        ['च'] = "ch", ['छ'] = "chh", ['ज'] = "j", ['झ'] = "jh", ['ञ'] = "ny",
        ['ट'] = "t", ['ठ'] = "th", ['ड'] = "d", ['ढ'] = "dh", ['ण'] = "n",
        ['त'] = "t", ['थ'] = "th", ['द'] = "d", ['ध'] = "dh", ['न'] = "n",
        ['प'] = "p", ['फ'] = "ph", ['ब'] = "b", ['भ'] = "bh", ['म'] = "m",
        ['य'] = "y", ['र'] = "r", ['ल'] = "l", ['व'] = "v", ['श'] = "sh",
        ['ष'] = "sh", ['स'] = "s", ['ह'] = "h"
    };
    private static readonly IReadOnlyDictionary<char, string> HindiVowels = new Dictionary<char, string>
    {
        ['अ'] = "a", ['आ'] = "a", ['इ'] = "i", ['ई'] = "i", ['उ'] = "u", ['ऊ'] = "u",
        ['ऋ'] = "ri", ['ए'] = "e", ['ऐ'] = "ai", ['ओ'] = "o", ['औ'] = "au"
    };
    private static readonly IReadOnlyDictionary<char, string> HindiMatras = new Dictionary<char, string>
    {
        ['ा'] = "a", ['ि'] = "i", ['ी'] = "i", ['ु'] = "u", ['ू'] = "u",
        ['ृ'] = "ri", ['े'] = "e", ['ै'] = "ai", ['ो'] = "o", ['ौ'] = "au"
    };

    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public StudentDuesAssistantController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpPost("ask")]
    public async Task<ActionResult<StudentDuesAssistantResponse>> Ask(
        [FromBody] StudentDuesAssistantRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Question) || request.Question.Length > 200)
        {
            return BadRequest(new { message = "Enter a question of up to 200 characters." });
        }

        var user = await _db.Users.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(
                u => u.Id == _currentUser.UserId && u.TenantId == _currentUser.TenantId,
                cancellationToken);
        if (user == null || !await HasDuesAccessAsync(user, cancellationToken))
        {
            return Forbid();
        }

        var studentQuery = _db.Students.AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Batch)
                .ThenInclude(batch => batch!.Class)
            .Where(s => s.TenantId == _currentUser.TenantId && !s.IsDeleted);

        var branchId = _currentUser.BranchId;
        if (branchId.HasValue)
        {
            studentQuery = studentQuery.Where(s => s.BranchId == branchId.Value);
        }

        if (user.Role == UserRole.Student || user.Role == UserRole.Parent)
        {
            studentQuery = studentQuery.Where(s =>
                s.UserId == user.Id || s.ParentUserId == user.Id);
        }

        Student? student = null;
        if (request.StudentId.HasValue)
        {
            student = await studentQuery.FirstOrDefaultAsync(
                s => s.Id == request.StudentId.Value,
                cancellationToken);
            if (student == null)
            {
                return Forbid();
            }
        }
        else
        {
            var tokens = GetNameTokens(request.Question);
            if (tokens.Count == 0)
            {
                return Ok(new StudentDuesAssistantResponse(
                    "clarification",
                    "Kis student ke dues check karne hain? Student ka naam ya roll number likhein."));
            }

            var parameter = Expression.Parameter(typeof(Student), "student");
            var nameProperty = Expression.Property(parameter, nameof(Student.StudentName));
            var rollProperty = Expression.Property(parameter, nameof(Student.RollNumber));
            var contains = typeof(string).GetMethod(nameof(string.Contains), new[] { typeof(string) })!;
            Expression? searchExpression = null;
            foreach (var token in GetCandidateSearchTokens(tokens))
            {
                var nameMatch = Expression.Call(nameProperty, contains, Expression.Constant(token));
                var rollMatch = Expression.Call(rollProperty, contains, Expression.Constant(token));
                var tokenMatch = Expression.OrElse(nameMatch, rollMatch);
                searchExpression = searchExpression == null
                    ? tokenMatch
                    : Expression.OrElse(searchExpression, tokenMatch);
            }

            var predicate = Expression.Lambda<Func<Student, bool>>(searchExpression!, parameter);
            var candidates = await studentQuery.Where(predicate).Take(100).ToListAsync(cancellationToken);
            var candidateLimitReached = candidates.Count == 100;
            var rankedCandidates = candidates
                .Select(candidate => new
                {
                    Student = candidate,
                    Score = GetMatchScore(candidate, tokens)
                })
                .Where(candidate => candidate.Score > 0)
                .OrderByDescending(candidate => candidate.Score)
                .ThenBy(candidate => candidate.Student.StudentName)
                .ToList();

            if (rankedCandidates.Count == 0)
            {
                return Ok(new StudentDuesAssistantResponse(
                    "notFound",
                    "Is branch mein is naam se student nahi mila. Naam ya roll number dobara check karein."));
            }

            var bestScore = rankedCandidates[0].Score;
            var bestMatches = rankedCandidates.Where(candidate => candidate.Score == bestScore).ToList();
            if (bestMatches.Count > 1 || candidateLimitReached)
            {
                var matchingStudents = bestMatches.Count > 1
                    ? bestMatches.Take(10).Select(candidate => candidate.Student)
                    : Enumerable.Empty<Student>();
                var matches = matchingStudents.Select(candidate => new StudentDuesAssistantMatch(
                    candidate.Id,
                    candidate.StudentName,
                    candidate.RollNumber,
                    candidate.Class?.Name ?? candidate.Batch?.Class?.Name,
                    candidate.Batch?.Name)).ToList();

                return Ok(new StudentDuesAssistantResponse(
                    "clarification",
                    candidateLimitReached && bestMatches.Count == 1
                        ? "Bahut saare students match hue. Sahi student ko identify karne ke liye uska poora naam ya roll number likhein."
                        : "Ek se zyada students match hue. Sahi student select karein:",
                    Matches: matches));
            }

            student = rankedCandidates[0].Student;
        }

        var invoices = await _db.FeeInvoices.AsNoTracking()
            .Include(invoice => invoice.Items)
            .Where(invoice =>
                invoice.TenantId == _currentUser.TenantId &&
                invoice.StudentId == student.Id &&
                invoice.Status != InvoiceStatus.Cancelled &&
                (!branchId.HasValue || invoice.BranchId == null || invoice.BranchId == branchId.Value))
            .ToListAsync(cancellationToken);

        var amountsByCategory = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var amountsByPeriod = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        decimal invoicedLibraryFine = 0m;

        foreach (var invoice in invoices)
        {
            var invoiceDue = Math.Max(0m, invoice.TotalAmount - invoice.PaidAmount);
            if (invoiceDue == 0m)
            {
                continue;
            }

            var period = GetInvoicePeriod(invoice);
            amountsByPeriod[period] = amountsByPeriod.TryGetValue(period, out var periodAmount)
                ? periodAmount + invoiceDue
                : invoiceDue;

            var itemDues = invoice.Items
                .Select(item => new
                {
                    Item = item,
                    Due = Math.Max(0m, item.Amount - item.PaidAmount)
                })
                .Where(item => item.Due > 0m)
                .ToList();

            var itemDueTotal = itemDues.Sum(item => item.Due);
            if (itemDueTotal == 0m)
            {
                AddAmount(amountsByCategory, GetInvoiceCategory(invoice.InvoiceCategory), invoiceDue);
                continue;
            }

            decimal allocated = 0m;
            for (var index = 0; index < itemDues.Count; index++)
            {
                var item = itemDues[index];
                var amount = index == itemDues.Count - 1
                    ? invoiceDue - allocated
                    : Math.Round(invoiceDue * item.Due / itemDueTotal, 2, MidpointRounding.AwayFromZero);
                allocated += amount;

                var category = GetChargeCategory(item.Item.HeadName, item.Item.Description, invoice.InvoiceCategory);
                AddAmount(amountsByCategory, category, amount);
                if (category == "Library fines")
                {
                    invoicedLibraryFine += amount;
                }
            }
        }

        var libraryFineQuery = _db.LibraryCirculations.AsNoTracking()
            .Where(circulation =>
                circulation.TenantId == _currentUser.TenantId &&
                circulation.StudentId == student.Id &&
                circulation.FineStatus == "Pending");
        if (branchId.HasValue)
        {
            libraryFineQuery = libraryFineQuery.Where(circulation =>
                circulation.BranchId == null || circulation.BranchId == branchId.Value);
        }

        var pendingLibraryFine = await libraryFineQuery.SumAsync(
            circulation => (decimal?)circulation.FineAmount,
            cancellationToken) ?? 0m;
        var unbilledLibraryFine = Math.Max(0m, pendingLibraryFine - invoicedLibraryFine);
        AddAmount(amountsByCategory, "Library fines", unbilledLibraryFine);

        var breakdown = amountsByCategory
            .Where(item => item.Value > 0m)
            .OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
            .Select(item => new StudentDuesAssistantBreakdown(item.Key, item.Value))
            .ToList();
        var periods = amountsByPeriod
            .OrderBy(item => GetPeriodSortValue(item.Key))
            .Select(item => new StudentDuesAssistantPeriodBreakdown(item.Key, item.Value))
            .ToList();
        var totalDue = breakdown.Sum(item => item.Amount);
        var reply = totalDue == 0m
            ? $"{student.StudentName} ke abhi koi outstanding dues nahi hain."
            : $"{student.StudentName} ke total outstanding dues ₹{totalDue:N2} hain.";

        return Ok(new StudentDuesAssistantResponse(
            "answer",
            reply,
            student.StudentName,
            student.RollNumber,
            student.Class?.Name ?? student.Batch?.Class?.Name,
            student.Batch?.Name,
            totalDue,
            breakdown,
            DateTime.UtcNow,
            StudentId: student.Id,
            Periods: periods));
    }

    private async Task<bool> HasDuesAccessAsync(User user, CancellationToken cancellationToken)
    {
        if (user.Role is UserRole.SuperAdmin or UserRole.InstituteAdmin or UserRole.Parent or UserRole.Student)
        {
            return true;
        }

        if (!user.RoleId.HasValue)
        {
            return false;
        }

        var activeRole = await _db.Roles.AsNoTracking()
            .AnyAsync(
                role => role.Id == user.RoleId.Value &&
                        role.TenantId == user.TenantId &&
                        role.IsActive,
                cancellationToken);
        if (!activeRole)
        {
            return false;
        }

        return await _db.RolePermissions.AsNoTracking()
            .Where(permission => permission.RoleId == user.RoleId.Value && permission.CanView)
            .Join(
                _db.MenuItems.AsNoTracking(),
                permission => permission.MenuItemId,
                menu => menu.Id,
                (permission, menu) => menu.RouteUrl)
            .AnyAsync(
                route => route == "/fees" || route == "/finance/fee-recovery-agent",
                cancellationToken);
    }

    private static List<string> GetNameTokens(string question)
    {
        return Regex.Matches(question, @"[\p{L}\p{M}\p{N}]+")
            .Select(match => TransliterateHindi(match.Value))
            .Where(token => token.Length >= 2 && !QueryWords.Contains(token))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(6)
            .ToList();
    }

    private static IEnumerable<string> GetCandidateSearchTokens(IReadOnlyCollection<string> tokens)
    {
        return tokens
            .SelectMany(token => token.Length >= 5
                ? new[] { token, token[..3] }
                : new[] { token })
            .Distinct(StringComparer.OrdinalIgnoreCase);
    }

    private static string TransliterateHindi(string token)
    {
        if (!token.Any(character => character is >= '\u0900' and <= '\u097F'))
        {
            return token;
        }

        var result = new System.Text.StringBuilder(token.Length * 2);
        for (var index = 0; index < token.Length; index++)
        {
            var character = token[index];
            if (HindiVowels.TryGetValue(character, out var vowel))
            {
                result.Append(vowel);
            }
            else if (HindiConsonants.TryGetValue(character, out var consonant))
            {
                result.Append(consonant);
                var nextIndex = index + 1;
                if (nextIndex < token.Length && token[nextIndex] == '़')
                {
                    nextIndex++;
                }

                if (nextIndex < token.Length && HindiMatras.TryGetValue(token[nextIndex], out var matra))
                {
                    result.Append(matra);
                    index = nextIndex;
                }
                else if (nextIndex < token.Length && token[nextIndex] == '्')
                {
                    index = nextIndex;
                }
                else
                {
                    result.Append('a');
                }
            }
            else if (character is 'ं' or 'ँ')
            {
                result.Append('n');
            }
            else if (character == 'ः')
            {
                result.Append('h');
            }
            else if (character == '़' || character == '्' || character == 'ऽ')
            {
                continue;
            }
            else
            {
                result.Append(character);
            }
        }

        if (result.Length > 2 && result[^1] == 'a')
        {
            result.Length--;
        }

        return result.ToString();
    }

    private static int GetMatchScore(Student student, IReadOnlyCollection<string> tokens)
    {
        var nameParts = Regex.Matches(student.StudentName, @"[\p{L}\p{N}]+")
            .Select(match => match.Value)
            .ToList();
        var score = tokens.Sum(token => nameParts
            .Select(part => GetTokenMatchScore(part, token))
            .Append(student.RollNumber.Contains(token, StringComparison.OrdinalIgnoreCase) ? 4 : 0)
            .Max());
        return score;
    }

    private static int GetTokenMatchScore(string namePart, string token)
    {
        if (namePart.Equals(token, StringComparison.OrdinalIgnoreCase)) return 4;
        if (namePart.StartsWith(token, StringComparison.OrdinalIgnoreCase)) return 2;
        if (namePart.Contains(token, StringComparison.OrdinalIgnoreCase)) return 1;

        var maxDistance = token.Length >= 7 ? 2 : token.Length >= 4 ? 1 : 0;
        var distance = GetLevenshteinDistance(namePart, token, maxDistance);
        return distance switch
        {
            1 => 2,
            2 => 1,
            _ => 0
        };
    }

    private static int GetLevenshteinDistance(string left, string right, int maxDistance)
    {
        if (Math.Abs(left.Length - right.Length) > maxDistance)
        {
            return maxDistance + 1;
        }

        var previous = Enumerable.Range(0, right.Length + 1).ToArray();
        var current = new int[right.Length + 1];
        for (var leftIndex = 1; leftIndex <= left.Length; leftIndex++)
        {
            current[0] = leftIndex;
            var rowMinimum = current[0];
            for (var rightIndex = 1; rightIndex <= right.Length; rightIndex++)
            {
                current[rightIndex] = Math.Min(
                    Math.Min(current[rightIndex - 1] + 1, previous[rightIndex] + 1),
                    previous[rightIndex - 1] +
                    (char.ToUpperInvariant(left[leftIndex - 1]) == char.ToUpperInvariant(right[rightIndex - 1]) ? 0 : 1));
                rowMinimum = Math.Min(rowMinimum, current[rightIndex]);
            }

            if (rowMinimum > maxDistance)
            {
                return maxDistance + 1;
            }

            (previous, current) = (current, previous);
        }

        return previous[right.Length];
    }

    private static string GetInvoiceCategory(string? invoiceCategory)
    {
        if (invoiceCategory?.Contains("coach", StringComparison.OrdinalIgnoreCase) == true)
        {
            return "Coaching fees";
        }

        if (invoiceCategory?.Contains("school", StringComparison.OrdinalIgnoreCase) == true)
        {
            return "School fees";
        }

        if (invoiceCategory?.Contains("hostel", StringComparison.OrdinalIgnoreCase) == true)
        {
            return "Hostel";
        }

        if (invoiceCategory?.Contains("transport", StringComparison.OrdinalIgnoreCase) == true)
        {
            return "Transport";
        }

        if (invoiceCategory?.Contains("libr", StringComparison.OrdinalIgnoreCase) == true)
        {
            return "Library";
        }

        return "Other fees";
    }

    private static string GetChargeCategory(string? headName, string? description, string? invoiceCategory)
    {
        var label = $"{headName} {description}".ToLowerInvariant();
        if (label.Contains("fine") &&
            (label.Contains("libr") || invoiceCategory?.Contains("libr", StringComparison.OrdinalIgnoreCase) == true))
        {
            return "Library fines";
        }

        if (label.Contains("hostel") || label.Contains("boarding") || label.Contains("mess"))
        {
            return "Hostel";
        }

        if (label.Contains("transport") || label.Contains("bus fee") || label.Contains("bus charges"))
        {
            return "Transport";
        }

        if (label.Contains("libr") || label.Contains("book"))
        {
            return "Library";
        }

        return GetInvoiceCategory(invoiceCategory);
    }

    private static string GetInvoicePeriod(FeeInvoice invoice)
    {
        var monthMatches = new List<DateTime>();
        foreach (Match match in Regex.Matches(
                     invoice.Title,
                     @"\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{4})\b",
                     RegexOptions.IgnoreCase))
        {
            var monthName = match.Groups[1].Value;
            if (monthName.Equals("Sept", StringComparison.OrdinalIgnoreCase))
            {
                monthName = "Sep";
            }

            var format = monthName.Length > 3 ? "MMMM yyyy" : "MMM yyyy";
            if (DateTime.TryParseExact(
                    $"{monthName} {match.Groups[2].Value}",
                    format,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var periodDate))
            {
                monthMatches.Add(periodDate);
            }
        }

        monthMatches.Sort();

        if (monthMatches.Count == 1)
        {
            return monthMatches[0].ToString("MMMM yyyy", CultureInfo.InvariantCulture);
        }

        if (monthMatches.Count > 1)
        {
            return $"{monthMatches[0]:MMMM yyyy} – {monthMatches[^1]:MMMM yyyy}";
        }

        return invoice.DueDate.ToString("MMMM yyyy", CultureInfo.InvariantCulture);
    }

    private static DateTime GetPeriodSortValue(string period)
    {
        var match = Regex.Match(period, @"\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b");
        return match.Success
            ? DateTime.ParseExact(match.Value, "MMMM yyyy", CultureInfo.InvariantCulture)
            : DateTime.MaxValue;
    }

    private static void AddAmount(IDictionary<string, decimal> amounts, string category, decimal amount)
    {
        if (amount <= 0m)
        {
            return;
        }

        amounts[category] = amounts.TryGetValue(category, out var current)
            ? current + amount
            : amount;
    }
}

public sealed record StudentDuesAssistantRequest(string Question, Guid? StudentId = null);

public sealed record StudentDuesAssistantResponse(
    string Status,
    string Reply,
    string? StudentName = null,
    string? RollNumber = null,
    string? ClassName = null,
    string? BatchName = null,
    decimal? TotalDue = null,
    IReadOnlyList<StudentDuesAssistantBreakdown>? Breakdown = null,
    DateTime? AsOfUtc = null,
    IReadOnlyList<StudentDuesAssistantMatch>? Matches = null,
    Guid? StudentId = null,
    IReadOnlyList<StudentDuesAssistantPeriodBreakdown>? Periods = null);

public sealed record StudentDuesAssistantBreakdown(string Category, decimal Amount);

public sealed record StudentDuesAssistantPeriodBreakdown(string Period, decimal Amount);

public sealed record StudentDuesAssistantMatch(
    Guid StudentId,
    string StudentName,
    string RollNumber,
    string? ClassName,
    string? BatchName);
