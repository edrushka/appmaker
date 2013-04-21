/**
 * Allows hosting of multiple sites on one server.
 */
var httpProxy = require('http-proxy'),
    exec = require('child_process').exec,
    fs = require('fs')

process.title = 'nudgepadProxy'
var errorPage = fs.readFileSync(__dirname + '/error.html', 'utf8')
var starting = {}
var DATAPATH = __dirname + '/../../../nudgepad/'
var LOGSPATH = DATAPATH + 'logs/'
var SITESPATH = DATAPATH + 'sites/'
var ACTIVEPATH = DATAPATH + 'active/'
var PORTSPATH = DATAPATH + 'ports/'

var startSite = function (domain) {
  starting[domain] = true
  console.log('starting sleeping site: %s', domain)
  exec(__dirname + '/nudgepad.sh start ' + domain, function (err){
    if (err)
      console.log('Start site error %s', err)
  })
}

var notFoundHandler = function (req, res) {
  var domain = req.headers.host.split(/\:/)[0]
  // todo: this could cause some bad edge cases
  if (domain.match(/^www\./)) {
    res.writeHead(302, { 'Location': 'http://' + domain.substr(4) + req.url })
    console.log('www_redirect: %s', domain)
    res.end()
  } else {
    // todo: this may cause some bad edge cases.
    fs.exists(SITESPATH + domain, function (exists) {
      if (!exists) {
        console.log('unknown_host: %s', domain)
        res.writeHead(404)
        return res.end()
      } else {
        // Only start a site once
        if (starting[domain]) {
          res.writeHead(500)
          return res.end(errorPage)
        }
        startSite(domain)
        res.writeHead(500)
        return res.end(errorPage)
        
        
      }
    })
    
    
    
    
    
  }
}

var errorHandler = function (err, req, res) {
//  console.log(err)
//  console.log('proxy error')
  if (req && req.headers)
    console.log('error: %s %s%s', req.method, req.headers.host, req.url)
  res.writeHead(500)
  res.end(errorPage)
}

var server = httpProxy.createServer({
  hostnameOnly: true,
  router: {}
})

server.proxy.on('notFound', notFoundHandler)
server.proxy.on('proxyError', errorHandler)

server.listen(80)


var updatePorts = function () {
  var sites = server.proxy.proxyTable.router
  var files = fs.readdirSync(ACTIVEPATH)
  for (var i in files) {
    var domain = files[i]
    if (domain.match(/^\./))
      continue
    var port = fs.readFileSync(ACTIVEPATH + domain, 'utf8')
    sites[domain] = '127.0.0.1:' + port
    console.log('%s on port %s', domain, port)
  }
}

updatePorts()

fs.watch(ACTIVEPATH, function (event, domain) {
  var sites = server.proxy.proxyTable.router
  // Trigger public changed event
  console.log('event on %s', domain)
  var domain = domain.toLowerCase()
  if (domain.match(/^\./))
    return null
  if (fs.existsSync(ACTIVEPATH + domain)) {
    var port = fs.readFileSync(ACTIVEPATH + domain, 'utf8')
    sites[domain] = '127.0.0.1:' + port
    console.log('%s on port %s', domain, port)
  } else {
    console.log('deleting %s', sites[domain])
    delete sites[domain]
  }
})
