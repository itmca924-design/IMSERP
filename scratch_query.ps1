$env:SSH_ASKPASS = 'c:\Projects\IMSERP\askpass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$opts = @('-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-o', 'LogLevel=ERROR')
& ssh @opts root@187.126.126.121 "which sqlcmd || find /opt -name sqlcmd 2>/dev/null"
