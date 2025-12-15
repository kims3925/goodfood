pipeline {
    agent any

    tools {
        nodejs 'NodeJS-24'
    }

    environment {
        PROJECT_PATH = '/home/ubuntu/bandauto'
        NEXTAUTH_SECRET = credentials('nextauth-secret')
        GUEST_TOKEN_SECRET = credentials('guest-secret')
        JWT_SECRET = credentials('jwt-secret')
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing dependencies...'
                sh 'npm ci --legacy-peer-deps'
            }
        }

        stage('Generate Prisma Client') {
            steps {
                echo 'Generating Prisma client...'
                dir('db') {
                    sh 'npx prisma generate --schema prisma'
                }
            }
        }

        stage('Build Applications') {
            parallel {
                stage('Build shop-app') {
                    steps {
                        echo 'Building shop-app...'
                        sh 'npm run build:shop'
                    }
                }
                stage('Build sourcing-app') {
                    steps {
                        echo 'Building sourcing-app...'
                        sh 'npm run build:sourcing'
                    }
                }
            }
        }

        stage('Deploy') {
            
            steps {
                echo 'Deploying application...'
                sh """
                    cd ${PROJECT_PATH}

                    echo "=== Starting deployment ==="

                    # Git pull
                    echo ">>> Pulling latest code..."
                    git fetch origin main
                    git reset --hard origin/main

                    # Install dependencies
                    echo ">>> Installing dependencies..."
                    npm ci

                    # Generate Prisma client
                    echo ">>> Generating Prisma client..."
                    cd db
                    npx prisma generate --schema prisma
                    cd ..

                    # Build applications
                    echo ">>> Building applications..."
                    npm run build:shop
                    npm run build:sourcing

                    # Restart PM2
                    echo ">>> Restarting PM2 processes..."
                    pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js

                    # Verify
                    echo ">>> Verifying deployment..."
                    pm2 status

                    echo "=== Deployment completed! ==="
                """
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed!'
        }
        always {
            echo "Build #${env.BUILD_NUMBER} finished with status: ${currentBuild.currentResult}"
            cleanWs()
        }
    }
}
