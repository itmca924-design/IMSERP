namespace IMSERP.Application.DTOs;

public record HostelDto(
    Guid Id,
    Guid TenantId,
    Guid? BranchId,
    string? BranchName,
    string Name,
    string HostelType, // Boys, Girls, Co-ed, Staff
    string? Address,
    string? WardenName,
    string? WardenPhone,
    int TotalFloors,
    int TotalRooms,
    int TotalBeds,
    int OccupiedBeds,
    int AvailableBeds,
    bool IsActive,
    DateTime CreatedAt
);

public record CreateHostelDto(
    string Name,
    string HostelType,
    string? Address,
    string? WardenName,
    string? WardenPhone,
    int TotalFloors = 1,
    Guid? BranchId = null
);

public record HostelRoomDto(
    Guid Id,
    Guid TenantId,
    Guid? BranchId,
    Guid HostelId,
    string HostelName,
    string RoomNumber,
    string Floor,
    string RoomType, // Single, Double, Triple, 4-Bed, Dormitory
    int Capacity,
    decimal MonthlyRent,
    bool HasAC,
    bool HasAttachedBath,
    string? Amenities,
    string Status, // Active, UnderMaintenance
    int BedCount,
    int OccupiedBedCount,
    List<HostelBedDto> Beds
);

public record CreateHostelRoomDto(
    Guid HostelId,
    string RoomNumber,
    string Floor = "Ground",
    string RoomType = "Double",
    int Capacity = 2,
    decimal MonthlyRent = 0.00m,
    bool HasAC = false,
    bool HasAttachedBath = false,
    string? Amenities = null,
    bool AutoGenerateBeds = true
);

public record HostelBedDto(
    Guid Id,
    Guid RoomId,
    string RoomNumber,
    Guid HostelId,
    string HostelName,
    string BedCode,
    string Status, // Available, Occupied, Maintenance, Reserved
    decimal MonthlyRent,
    Guid? CurrentStudentId,
    string? StudentName,
    string? RollNumber,
    string? ParentPhone,
    string? ClassOrBatch,
    string? ProfilePhoto
);

public record HostelAllocationDto(
    Guid Id,
    Guid StudentId,
    string StudentName,
    string? RollNumber,
    string? ParentWhatsAppPhone,
    string? ClassOrBatch,
    Guid BedId,
    string BedCode,
    string RoomNumber,
    Guid HostelId,
    string HostelName,
    DateTime AllocatedDate,
    DateTime? VacatedDate,
    decimal MonthlyRent,
    bool IsMessIncluded,
    string MessPlan,
    decimal MonthlyMessFee,
    string Status, // Active, Vacated, Transferred
    string? Remarks
);

public record AllocateBedDto(
    Guid StudentId,
    Guid BedId,
    DateTime? AllocatedDate,
    decimal? MonthlyRent,
    bool IsMessIncluded = true,
    string MessPlan = "Full Board",
    decimal MonthlyMessFee = 0.00m,
    string? Remarks = null
);

public record VacateBedDto(
    Guid AllocationId,
    DateTime? VacatedDate,
    string? Remarks
);

public record HostelGatePassDto(
    Guid Id,
    Guid StudentId,
    string StudentName,
    string? RollNumber,
    string? ClassOrBatch,
    string? RoomAndBed,
    string PassNumber,
    DateTime OutDate,
    DateTime ExpectedReturnDate,
    DateTime? ActualReturnDate,
    string Purpose,
    bool ParentConsentGiven,
    string? ParentContactNumber,
    string WardenApprovalStatus,
    string? ApprovedByWarden,
    string? Remarks,
    DateTime CreatedAt
);

public record GatePassPagedResultDto(
    List<HostelGatePassDto> Items,
    int TotalCount,
    int PageIndex,
    int PageSize,
    int TotalPages,
    int ActiveOutCount,
    int CompletedCount,
    int OverdueCount
);

public record CreateGatePassDto(
    Guid StudentId,
    DateTime OutDate,
    DateTime ExpectedReturnDate,
    string Purpose,
    bool ParentConsentGiven = true,
    string? ParentContactNumber = null,
    string? Remarks = null
);

public record HostelAttendanceDto(
    Guid Id,
    Guid StudentId,
    string StudentName,
    string? RollNumber,
    string? RoomAndBed,
    Guid HostelId,
    string HostelName,
    DateTime AttendanceDate,
    string RollCallShift,
    string Status,
    string CaptureSource,
    string? PunchTime,
    string? BiometricDeviceId,
    string? BiometricUserId,
    bool HasActiveGatePass,
    string? GatePassDetails,
    string? MarkedBy,
    string? Remarks
);

public record HostelAttendanceSettingsDto(
    string HostelMode
);

public record SimulateBiometricPunchDto(
    Guid? StudentId,
    string? BiometricUserId,
    string? DeviceId,
    string? Shift = "Night",
    DateTime? PunchTime = null
);

public record UpdateResidentBiometricMappingDto(
    Guid StudentId,
    string BiometricUserId
);

public record BulkRollCallDto(
    Guid HostelId,
    DateTime AttendanceDate,
    string RollCallShift,
    List<StudentRollCallItemDto> Items
);

public record StudentRollCallItemDto(
    Guid StudentId,
    string Status,
    string? Remarks
);

public record HostelOverviewSummaryDto(
    int TotalHostels,
    int TotalRooms,
    int TotalBeds,
    int OccupiedBeds,
    int AvailableBeds,
    decimal OccupancyRate,
    int ActiveGatePasses,
    int HostelerStudentsCount
);

public record HostelStudentSearchResultDto(
    Guid Id,
    string StudentName,
    string RollNumber,
    string? AdmissionNumber,
    string? SchoolRollNumber,
    string? CoachingRollNumber,
    string? Gender,
    bool IsSchoolStudent,
    bool IsCoachingStudent,
    bool IsHostelStudent,
    Guid? HostelBedId,
    string? ClassName,
    string? SectionName,
    string? BatchName,
    string? ProfilePhoto,
    string? ParentName,
    string? ParentPhone,
    string? GroupName,
    string? CurrentBedInfo,
    bool IsAlreadyAllocated
);
