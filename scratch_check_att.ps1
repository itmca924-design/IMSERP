Add-Type -Path 'C:\Projects\IMSERP\backend\IMSERP.API\bin\Debug\net10.0\Microsoft.Data.SqlClient.dll'
$conn = New-Object Microsoft.Data.SqlClient.SqlConnection('Server=localhost;Database=IMSERP;Trusted_Connection=True;TrustServerCertificate=True;')
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COUNT(1) as TotalCount, MIN(AttendanceDate) as MinDate, MAX(AttendanceDate) as MaxDate FROM TeacherAttendances"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    Write-Output ("Total Attendance Records: " + $reader["TotalCount"] + " | Min: " + $reader["MinDate"] + " | Max: " + $reader["MaxDate"])
}
$reader.Close()

$cmd2 = $conn.CreateCommand()
$cmd2.CommandText = "SELECT t.FullName, t.EmployeeCode, COUNT(a.Id) as OctRecords FROM Teachers t LEFT JOIN TeacherAttendances a ON t.Id = a.TeacherId AND MONTH(a.AttendanceDate) = 10 AND YEAR(a.AttendanceDate) = 2026 WHERE t.EmployeeCode = 'JNANDEEP-TCH-017' GROUP BY t.FullName, t.EmployeeCode"
$r2 = $cmd2.ExecuteReader()
while ($r2.Read()) {
    Write-Output ("Teacher: " + $r2["FullName"] + " | Oct Records: " + $r2["OctRecords"])
}
$r2.Close()
$conn.Close()
