/* eslint-disable no-undef */

$(document).ready(function () {
  var create_aws_environment_button = document.getElementById('create_aws_environment_button')
  var save_environment_button = document.getElementById('save_environment_button')
  if (create_aws_environment_button) {
    create_aws_environment_button.addEventListener('click', function () {
      createAWSEnvironment()
    }, false)
  }
  if (save_environment_button) {
    save_environment_button.addEventListener('click', function () {
      saveData()
    }, false)
  }

  if (window.location.href.includes('servers')) {
    updateProvisioningStatus()
    updateTimer = window.setInterval(updateProvisioningStatus, 2000)
  }
})

var updateTimer

function createAWSEnvironment () {
  // Schedule the jobs in the database
  $.post('/servers/schedule', {}, function () {
    $('#create_aws_environment_button').hide()
    $('#environment-loading').show()
  })

}


function updateProvisioningStatus () {
  String.prototype.contains = function(it) { return this.indexOf(it) != -1; };
  var numberOfTasks = 0;
  var completedTasks = 0;
  $.get('/servers/tasks/ec2', function (taskData) {

    for (var i = 0; i < taskData.length; i++) {
      var taskName = taskData[i].task_id
      // Match the task with the server in environmentModel
      for (var e = 0; e < environmentModel.servers().length; e++) {
        for (var m = 0; m < environmentModel.servers()[e].members().length; m++) {
          status = ''
          if (taskName.contains(environmentModel.servers()[e].members()[m].name())) {
            numberOfTasks++;
            (function (taskData, e, m, i) {
              var runId = taskData[i].run_id
              $.get('/restate-machines/' + runId, function (data) {
                var result = JSON.parse(data)
                var status = JSON.parse(result.StatusMessage)
                if(status.status === 'failed') {
                    $("#pre-flight-failed").show()
                }
                if(status.status === 'done') {
                  completedTasks++;
                  var hostname = JSON.parse(result.Input).public_dns
                  var password = JSON.parse(result.Input).password
                  environmentModel.servers()[e].members()[m].hostname(hostname)
                  if (typeof environmentModel.servers()[e].members()[m].password == 'function')
                  {
                    environmentModel.servers()[e].members()[m].password(password)
                  }
                  if(completedTasks == numberOfTasks) {
                    $('#environment-loading').hide()
                    $('#provisioning-complete').show()
                    $('#create_aws_environment_button').hide()
                    window.clearInterval(updateTimer)
                  }
                }
                environmentModel.servers()[e].members()[m].provisioning_status.message(status.message)
                environmentModel.servers()[e].members()[m].provisioning_status.status(status.status)
                console.log(result.StatusMessage)
              })
            })(taskData, e, m, i)
          }
        }
      }
    }
  })
}


function saveData () {
  var dataToSave = JSON.parse(ko.toJSON(environmentModel))
  delete dataToSave.__ko_mapping__
  $.ajax({
    url: '/platform-options',
    type: 'PUT',
    success: function () {
    },
    data: { name: environmentName, platformData: JSON.stringify(dataToSave)}
  })
}
