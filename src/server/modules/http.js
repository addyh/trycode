// these are for the logger
var fs = require('fs');
var path = require('path');
var rfs = require('rotating-file-stream');
var morgan = require('../morgan');

import CookieParser from 'restify-cookies';
import Restify from 'restify';
import unirest from 'unirest';

import config from '../config';

import CodeClass from '../classes/CodeClass';

// create the server
const app = Restify.createServer();

// ensure log directory exists
var logDirectory = path.join(__dirname, '../../', 'access-logs');
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

// create a rotating write stream
var accessLogStream = rfs('access.log', {
  interval: '1d', // rotate daily
  path: logDirectory
});

// Setup the logger
app.use(morgan('csv', {stream: accessLogStream}));
app.use(morgan(':remote-addr [:date[custom]] :method :url'));

app.use(Restify.bodyParser());
app.use(CookieParser.parse);

const Code = new CodeClass();

app.get(/\/public\/?.*/, Restify.serveStatic({
  directory: __dirname.replace('dist\\modules','')
}));

app.get('/', function indexHTML(req, res, next) {

  Code.create(req, res, next);

});

app.get('/lib/:name', function indexHTML(req, res, next) {

  const name = req.params.name;

  unirest.get('https://cdnjs.com/libraries/' + name)
    .end(function(response) {
      res.send(response.body);
      return next();
    });

});

app.get('/:cid', function(req, res, next) {

  Code.get(req, res, next);

});

app.get('get/:cid', function(req, res, next) {

  Code.json(req, res, next);

});

app.post('save/:cid', function(req, res, next) {

  Code.save(req, res, next);

});

app.listen(config.options.PORT);

console.log('Server started at http://localhost:' + config.options.PORT);

export default { app };
