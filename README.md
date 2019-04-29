This is a test project on Zalenium for Protractor-Cucumber-Typescript framework
-------------------------------

Testing Framework Technologies
-------------------------------
Protractor
Cucumber
Prerequisites
Node JS environment Docker

Installs and Config:
-----------------------
From the e2e_tests directory:

npm install -g protractor

nvm install 8.11.3 or nvm use 8.11.3 ( Version should be same as in .nvmrc file)

npm install

Pull Docker Selenium and Setup Zalenium from docker-compose file:
-----------------------------------------------------------------
docker pull elgalu/selenium

docker-compose up --force-recreate

To run e2e tests:
-----------------
From e2e_tests directory:

gulp test or gulp test -n (n is the suite name)
