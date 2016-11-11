var dbh = require('../lib/database_helper')
var request = require('request')
var PlatformOption = require('../platform-options/model')
var Server = function (data) {
  this.data = data
}

Server.prototype.data = {}

// TODO: refactor this function
Server.scheduleEnvironmentFromJson = function (environmentId, data, callback, onError) {
  var servers = this.filterSelectedServers(data.servers)
  var environmentName = data.environmentName
  var scheduledServers = 0

  for (var memberId = 0; memberId < servers.length; memberId++) {

    (function (curServer, onError) {
      var roleCount = 0
      var security_groups = []
      for (var roleId = 0; roleId < curServer.roles.length; roleId++) {
        PlatformOption.getRoleByName(curServer.roles[roleId].class, function (roleData) {
          roleCount++
          for (var securityGroupId = 0; securityGroupId < roleData.firewall.length; securityGroupId++) {
            security_groups.push(roleData.firewall[securityGroupId])
          }

          // All async operations are complete
          if (roleCount === curServer.roles.length) {
            // Schedule the job
            var jobData = {}
            jobData.data = {
              machine: 'create_ec2_server',
              key_name: 'stefan-test-aws',
              vpc_id: 'vpc-ad0f6ac9',
              instance_name: '(' + environmentName + ') ' + curServer.name,
              ami: curServer.ami,
              type: curServer.ec2_type,
              security_groups: security_groups,
              existing_security_groups: ['default'],
              os: curServer.operating_system
            }
            var options = {
              url: 'http://localhost:3000/restate-machines',
              method: 'POST',
              body: jobData,
              json: true
            }
            request(options, function (error, response, body) {
              if (error) {
                // Handle error here
              }
              var runId = JSON.parse(body).Id
              // Run scheduled add a reference to the database
              // TODO: we should not allow duplicate task_ids for an environment
              dbh.query("INSERT INTO tasks VALUES(null,'" + curServer.name + "', '" + runId + "', '" + JSON.stringify(jobData) + "', null, " + environmentId + ", 'ec2')",
              function () {
                scheduledServers++
                if (scheduledServers == servers.length) {
                  callback()
                }
              }, function (err) {
                // dbh.query failed
                onError(err)
              })
            })
          }
        })
      }
    })(servers[memberId], onError)

  }
}

Server.filterSelectedServers = function (servers) {
  var serverList = []
  for (var categoryId = 0; categoryId < servers.length; categoryId++) {
    for (var memberId = 0; memberId < servers[categoryId].members.length; memberId++) {
      if(servers[categoryId].members[memberId].selected == true) {
        serverList.push(servers[categoryId].members[memberId])
      }
    }
  }
  return serverList
}
Server.getAllTasks = function (platformId, task_type, callback, onError) {
  dbh.query('SELECT * from tasks where type = \''+task_type+'\' AND fk_platform_data = ' + platformId +'', function (result) {
    callback(result)
  }, function (err) {
    onError(err)
  })
}

Server.updateTask = function (task, callback, onError) {
  dbh.query("UPDATE tasks SET status = '" + task.status + "' WHERE id = " + task.id, function () {
    callback(true)
  }, function (err) {
    onError(err)
  })
}

module.exports = Server