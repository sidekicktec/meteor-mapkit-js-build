var require = meteorInstall({"server":{"main.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// server/main.js                                                    //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }
}, 0);
Meteor.startup(() => {});
Meteor.methods({
  'mapkit.token'() {
    return "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkxIUFY5NDJYRFQifQ.eyJpc3MiOiJLRlVIUDNaMzU2IiwiaWF0IjoxNjcyNjEwOTAzLCJleHAiOjE2ODkxMjAwMDB9._KAUhDmkgKfQXgsoc3fl96XDDS_ChrdxJ4KuKQxV0_UpchRS4N2Is3CjxkXQ62NsRcpiBnOdZ7sLqWNljStLYg";
  }
});
///////////////////////////////////////////////////////////////////////

}}},{
  "extensions": [
    ".js",
    ".json",
    ".ts"
  ]
});

var exports = require("/server/main.js");
//# sourceURL=meteor://💻app/app/app.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvc2VydmVyL21haW4uanMiXSwibmFtZXMiOlsiTWV0ZW9yIiwibW9kdWxlIiwibGluayIsInYiLCJzdGFydHVwIiwibWV0aG9kcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQSxJQUFJQSxNQUFNO0FBQUNDLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLGVBQWUsRUFBQztFQUFDRixNQUFNLENBQUNHLENBQUMsRUFBQztJQUFDSCxNQUFNLEdBQUNHLENBQUM7RUFBQTtBQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7QUFFL0RILE1BQU0sQ0FBQ0ksT0FBTyxDQUFDLE1BQU0sQ0FDckIsQ0FBQyxDQUFDO0FBR0ZKLE1BQU0sQ0FBQ0ssT0FBTyxDQUFDO0VBQ2IsY0FBYyxHQUFHO0lBQ2YsT0FBTyxnT0FBZ087RUFDek87QUFDRixDQUFDLENBQUMsQyIsImZpbGUiOiIvYXBwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5cbk1ldGVvci5zdGFydHVwKCgpID0+IHtcbn0pO1xuXG5cbk1ldGVvci5tZXRob2RzKHtcbiAgJ21hcGtpdC50b2tlbicoKSB7XG4gICAgcmV0dXJuIFwiZXlKaGJHY2lPaUpGVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0lzSW10cFpDSTZJa3hJVUZZNU5ESllSRlFpZlEuZXlKcGMzTWlPaUpMUmxWSVVETmFNelUySWl3aWFXRjBJam94TmpjeU5qRXdPVEF6TENKbGVIQWlPakUyT0RreE1qQXdNREI5Ll9LQVVoRG1rZ0tmUVhnc29jM2ZsOTZYRERTX0NocmR4SjRLdUtReFYwX1VwY2hSUzROMklzM0NqeGtYUTYyTnNSY3BpQm5PZFo3c0xxV05salN0TFlnXCJcbiAgfVxufSkiXX0=
