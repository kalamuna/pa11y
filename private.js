process.env.PORT = 80
process.env.NOINDEX = true
process.env.READONLY = false
process.env.WEBSERVICE_DATABASE = 'mongodb://localhost/pa11y-webservice'
process.env.WEBSERVICE_HOST = '0.0.0.0'
process.env.WEBSERVICE_PORT = 3001
process.env.WEBSERVICE_CRON = '0 30 0 * * *'

require('./index.js')
