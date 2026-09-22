#!/usr/bin/env bash
#
# configure-jenkins-ui.sh
#
# Creates/updates a Jenkins pipeline job for the UI repo, using the Jenkins
# REST API (no jenkins-cli.jar - the CLI hits 403 "Unexpected request origin"
# behind this setup). Uses the same crumb-based approach as configure-jenkins.sh
# for the backend.
#
# Usage (on the EC2 host, after Jenkins is already installed/running):
#   sudo JENKINS_USER=ermsuperadmin JENKINS_PASSWORD='...' bash configure-jenkins-ui.sh
#
set -euo pipefail

JENKINS_URL="${JENKINS_URL:-http://localhost:8080}"
JOB_NAME="${JOB_NAME:-ermui-deploy}"
REPO_URL="${REPO_URL:-https://github.com/mauliksolanki-bot/businessprocess-erm-ui.git}"
REPO_BRANCH="${REPO_BRANCH:-production}"
SCRIPT_PATH="${SCRIPT_PATH:-Jenkinsfile}"

JENKINS_USER="${JENKINS_USER:-}"
JENKINS_PASSWORD="${JENKINS_PASSWORD:-}"

log() { echo -e "\n\033[1;32m==> $*\033[0m"; }

if [[ -z "${JENKINS_USER}" || -z "${JENKINS_PASSWORD}" ]]; then
  echo "JENKINS_USER and JENKINS_PASSWORD must be set (existing Jenkins admin credentials)." >&2
  exit 1
fi

log "Waiting for Jenkins to respond on ${JENKINS_URL}"
for i in {1..30}; do
  if curl -sf -u "${JENKINS_USER}:${JENKINS_PASSWORD}" "${JENKINS_URL}/api/json" -o /dev/null; then
    break
  fi
  sleep 5
done

COOKIE_JAR="$(mktemp)"
trap 'rm -f "${COOKIE_JAR}"' EXIT

log "Fetching CSRF crumb"
CRUMB_JSON="$(curl -sf -u "${JENKINS_USER}:${JENKINS_PASSWORD}" -c "${COOKIE_JAR}" "${JENKINS_URL}/crumbIssuer/api/json")"
CRUMB_FIELD="$(echo "${CRUMB_JSON}" | grep -o '"crumbRequestField":"[^"]*"' | cut -d'"' -f4)"
CRUMB_VALUE="$(echo "${CRUMB_JSON}" | grep -o '"crumb":"[^"]*"' | cut -d'"' -f4)"

curl_auth() {
  curl -sS -u "${JENKINS_USER}:${JENKINS_PASSWORD}" -b "${COOKIE_JAR}" -H "${CRUMB_FIELD}: ${CRUMB_VALUE}" "$@"
}

CONFIG_XML=$(cat <<EOF
<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>Builds and deploys businessprocess-erm-ui (branch ${REPO_BRANCH})</description>
  <keepDependencies>false</keepDependencies>
  <properties/>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps">
    <scm class="hudson.plugins.git.GitSCM" plugin="git">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>${REPO_URL}</url>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/${REPO_BRANCH}</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class="empty-list"/>
      <extensions/>
    </scm>
    <scriptPath>${SCRIPT_PATH}</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
EOF
)

log "Checking if job '${JOB_NAME}' already exists"
if curl_auth -o /dev/null -w "%{http_code}" "${JENKINS_URL}/job/${JOB_NAME}/api/json" | grep -q "^200$"; then
  log "Updating existing job '${JOB_NAME}'"
  curl_auth -X POST "${JENKINS_URL}/job/${JOB_NAME}/config.xml" \
    -H "Content-Type: application/xml" \
    --data-binary "${CONFIG_XML}"
else
  log "Creating Pipeline job '${JOB_NAME}' (SCM: ${REPO_URL} @ ${REPO_BRANCH}, script: ${SCRIPT_PATH})"
  curl_auth -X POST "${JENKINS_URL}/createItem?name=${JOB_NAME}" \
    -H "Content-Type: application/xml" \
    --data-binary "${CONFIG_XML}"
fi

log "Triggering initial build of '${JOB_NAME}'"
curl_auth -X POST "${JENKINS_URL}/job/${JOB_NAME}/build" || true

log "Done. Check ${JENKINS_URL}/job/${JOB_NAME}/ for build progress."
