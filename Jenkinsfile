pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        APP_SRC_DIR   = '/opt/ermui/src'
        SERVICE_NAME  = 'ermui'
        STAGING_DIR   = '/tmp/ermui-jenkins-build'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install & Build') {
            steps {
                sh '''
                    set -e
                    node -v
                    npm -v
                    npm ci
                    npm run build
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    set -e
                    rm -rf "$STAGING_DIR"
                    mkdir -p "$STAGING_DIR"
                    rsync -a --delete \
                        --exclude 'node_modules' \
                        --exclude '.git' \
                        ./ "$STAGING_DIR"/
                    sudo /usr/bin/rsync -a --delete "$STAGING_DIR"/ "$APP_SRC_DIR"/
                    sudo /bin/chown -R ermui:ermui "$APP_SRC_DIR"
                    sudo -u ermui bash -c "rm -rf '$APP_SRC_DIR/.next' '$APP_SRC_DIR/node_modules'"
                    sudo -u ermui bash -c "cd '$APP_SRC_DIR' && unset NODE_ENV NPM_CONFIG_PRODUCTION npm_config_production && npm ci --include=dev"
                    sudo -u ermui bash -c "cd '$APP_SRC_DIR' && node -e \"require.resolve('@tailwindcss/postcss')\"" || \
                        sudo -u ermui bash -c "cd '$APP_SRC_DIR' && unset NODE_ENV && npm install --no-save @tailwindcss/postcss tailwindcss"
                    sudo -u ermui bash -c "cd '$APP_SRC_DIR' && export \$(grep -E '^NEXT_PUBLIC_' /etc/ermui/ermui.env | xargs -d '\n') && npm run build"
                    rm -rf "$STAGING_DIR"
                    sudo systemctl restart "$SERVICE_NAME"
                '''
            }
        }

        stage('Verify') {
            steps {
                sh '''
                    set -e
                    sleep 8
                    sudo systemctl is-active "$SERVICE_NAME"
                    for i in 1 2 3 4 5 6 7 8 9 10; do
                        if curl -sf http://localhost:3000 -o /dev/null; then
                            echo "UI is responding on port 3000"
                            exit 0
                        fi
                        sleep 5
                    done
                    echo "UI did not respond on port 3000 in time"
                    exit 1
                '''
            }
        }
    }

    post {
        success {
            echo 'UI build & deploy succeeded.'
        }
        failure {
            echo 'UI build or deploy failed - see stage logs above.'
        }
    }
}
