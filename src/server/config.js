'use strict';

var room_id = null;

var users = [];
var messages = [];

const key = Math.round(Math.random()*100000000000);

const colors = [
  '#2a84c7', // blur
  '#9c2ac7', // purple
  '#684dcc', // purple 2
  '#c72a2a', // red
  '#c76e2a', // orange
  '#83a20f', // green
  '#2aa20f', // grenn 2
  '#10b317', // grenn 3
  '#717171', // gray
  '#503838', // red black
  '#dc5db9', // pink
];

const options = {
  DEV: true,
  PORT: 81,
  ROOT: __dirname.replace(/(\\dist|\\dist\\modules)/g, '\\public')
};

var db = null;

db = require('knex')({
  client: 'mysql',
  connection: {
    host       : options.DEV ? 'localhost' : 'localhost',
    user       : options.DEV ? 'trycode' : 'trycode',
    password   : options.DEV ? '' : '',
    database   : options.DEV ? 'trycode_db' : 'trycode_db',
    // socketPath : options.DEV ? 'C:/XAMPP/mysql/mysql.sock' : '', // I have OSX and need mysql.sock
    charset    : 'utf8',
  }
});

export default {
  room_id,
  users,
  colors,
  messages,
  options,
  key,
  db
};
