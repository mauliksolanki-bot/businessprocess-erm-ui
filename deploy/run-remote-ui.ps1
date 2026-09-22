<#
.SYNOPSIS
    Copies deploy scripts to the EC2 host and runs the UI provisioning script,
    then optionally configures the Jenkins pipeline job for the UI.

.EXAMPLE
    .\deploy\run-remote-ui.ps1 -PublicIp 35.154.240.113 -KeyPath "C:\path\ERM-PROD-KEY.pem" -SshUser ubuntu
#>
param(
    [Parameter(Mandatory = $true)][string]$PublicIp,
    [Parameter(Mandatory = $true)][string]$KeyPath,
    [string]$SshUser = "ubuntu",
    [switch]$ConfigureJenkins,
    [string]$JenkinsUser,
    [string]$JenkinsPassword
)

$ErrorActionPreference = "Stop"
$remoteDir = "/tmp/ermui-deploy"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Invoke-Remote {
    param([string]$Command)
    & ssh -i $KeyPath -o StrictHostKeyChecking=accept-new "$SshUser@$PublicIp" $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Remote command failed (exit $LASTEXITCODE): $Command"
    }
}

Write-Host "==> Creating remote directory $remoteDir" -ForegroundColor Cyan
Invoke-Remote "mkdir -p $remoteDir"

Write-Host "`n==> Copying deploy scripts to $PublicIp" -ForegroundColor Cyan
& scp -i $KeyPath -o StrictHostKeyChecking=accept-new `
    "$scriptDir\provision-ui-server.sh" `
    "$scriptDir\configure-jenkins-ui.sh" `
    "${SshUser}@${PublicIp}:$remoteDir/"
if ($LASTEXITCODE -ne 0) { throw "scp failed with exit code $LASTEXITCODE" }

Write-Host "`n==> Running provision-ui-server.sh (installs Node.js, builds & starts the UI)" -ForegroundColor Cyan
Invoke-Remote "chmod +x $remoteDir/*.sh; sudo bash $remoteDir/provision-ui-server.sh"

if ($ConfigureJenkins) {
    if (-not $JenkinsUser -or -not $JenkinsPassword) {
        throw "ConfigureJenkins requires -JenkinsUser and -JenkinsPassword"
    }
    Write-Host "`n==> Configuring Jenkins pipeline job for the UI" -ForegroundColor Cyan
    Invoke-Remote "sudo JENKINS_USER='$JenkinsUser' JENKINS_PASSWORD='$JenkinsPassword' bash $remoteDir/configure-jenkins-ui.sh"
}

Write-Host "`n==> Done. UI should be reachable at http://$PublicIp:3000" -ForegroundColor Green
