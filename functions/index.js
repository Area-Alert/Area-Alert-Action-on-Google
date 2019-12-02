'use strict'

const {
      dialogflow,
      Permission,
      Suggestions,
      UpdatePermission,
      List,
      SimpleResponse
} = require('actions-on-google')
const functions = require('firebase-functions')
const config = require('./config')
const admin = require('firebase-admin')
const firebase = require('firebase')

// const firebaseConfig = config.firebaseConfig
// firebase.initializeApp(firebaseConfig)
admin.initializeApp(functions.config().firebase)
var db = admin.firestore()

const app = dialogflow({ debug: true })

app.intent('Default Welcome Intent', conv => {
      conv.ask
      conv.ask(new SimpleResponse({
            speech: 'Welcome!, Say make a report to make a report',
            text: "Click 'make a report' to make a report!"
      }))
      conv.ask(new Suggestions(['Make a Report', 'View Reports nearby']))
})

app.intent('Make Report', (conv) => {
      const permissions = ['NAME']
      let context = 'To address you by name'

      conv.data.locType = "make"

      // Location permissions only work for verified users
      // https://developers.google.com/actions/assistant/guest-users
      if (conv.user.verification === 'VERIFIED') {
            // Could use DEVICE_COARSE_LOCATION instead for city, zip code
            permissions.push('DEVICE_PRECISE_LOCATION')
            context += ' and know your location'
      } else {
            conv.close('We need your location to take a report')
      }
      const options = {
            context,
            permissions,
      }
      conv.ask(new Permission(options))
})

app.intent('location_permission_granted Make Report', (conv, params, granted) => {
      if (granted) {
            const { location } = conv.device
            const { latitude, longitude } = location.coordinates
            console.log("TAG", location.city, location.coordinates, location.formattedAddress, location.name, location.placeId)
            console.log("TAG", latitude, longitude)

            conv.data.report = {
                  'city': location.city,
                  'lat': location.coordinates.latitude,
                  'lon': location.coordinates.longitude,
                  'loc': new firebase.firestore.GeoPoint(latitude, longitude),
                  'address': location.formattedAddress,
                  'locationName': location.name,
                  'placeId': location.placeId,
                  'postalCode': location.zipCode,
                  'postalAddress': location.postalAddress,
                  'notes': location.notes,
                  'phoneNumber': location.phoneNumber,
                  'userId': conv.user.id,
                  'email': conv.user.email,
                  'name': conv.user.name,
                  'downloadurl': null,
            }

            conv.ask(`Hi, ${conv.user.name.display} you're at ${location.formattedAddress}, Tell us what the incident is about`)
      } else {
            console.log(conv, params, granted)
      }
})

app.intent('women', conv => {
      conv.data.report['report'] = conv.query
      conv.data.report['report_type'] = 'women'

      conv.ask(`Thanks ${conv.user.name.given}, for a making a report with Area Alert. Do you want to add more details?`)
      conv.ask(new Suggestions(['Yes', 'No']))
})

app.intent('congestion', conv => {
      conv.data.report['report'] = conv.query
      conv.data.report['report_type'] = 'congestion'

      conv.ask(`Thanks ${conv.user.name.given}, for a making a report with Area Alert. Do you want to add more details?`)
      conv.ask(new Suggestions(['Yes', 'No']))
})

app.intent('natural disaster', conv => {
      conv.data.report['report'] = conv.query
      conv.data.report['report_type'] = 'natural disaster'

      conv.ask(`Thanks ${conv.user.name.given}, for a making a report with Area Alert. Do you want to add more details?`)
      conv.ask(new Suggestions(['Yes', 'No']))
})

app.intent('yes - more details', conv => {
      conv.data.report['moreDetails'] = true

      conv.ask(`Great, Please tell us if people were injured and do they need medical attention?`)
      conv.ask(new Suggestions(['Yes', 'No']))
})

app.intent('no - more details', conv => {
      conv.data['moreDetails'] = false

      return new Promise((resolve, reject) => {
            db.collection('reports').doc(String(Number(new Date()))).set(conv.data.report)
                  .then((snapshot) => {
                        conv.ask('Sure no problem')
                        conv.close(`Thanks for using Area Alert!, We've recieved your report`)
                        resolve()
                        return null
                  })
                  .catch(err => {
                        console.log(err)
                  })
      })
})

app.intent('yes - medical help', conv => {
      conv.data.report['medicalAttention'] = true

      conv.ask('Sure, medical services have been informed and dispatched, should authorities be informed?')
})

app.intent('no - medical help', conv => {
      conv.data.report['medicalAttention'] = false

      conv.ask("That's great news, should authorities be informed?")
})

app.intent('yes - authorities', conv => {
      conv.data.report['authorities'] = true

      return new Promise((resolve, reject) => {
            db.collection('reports').doc(String(Number(new Date()))).set(conv.data.report)
                  .then((docSnap) => {
                        conv.close("Great, Authorities have been informed, Thanks for using Area Alert. We've recieved your report!")
                        resolve()
                        return null
                  })
                  .catch(err => console.log(err))
      })
})

app.intent('no - authorities', conv => {
      conv.data.report['authorities'] = false

      return new Promise((resolve, reject) => {
            db.collection('reports').doc(String(Number(new Date()))).set(conv.data.report)
                  .then((docSnap) => {
                        conv.close("Sure, no problem. Thanks for using Area Alert. We've recieved your report!")
                        resolve()
                        return null
                  })
                  .catch(err => console.log(err))
      })
})

app.intent('reports near me', conv => {
      if (conv.user.verification === 'VERIFIED') {
            // Could use DEVICE_COARSE_LOCATION instead for city, zip code
            var permissions = ['DEVICE_PRECISE_LOCATION']
            var context = [' and know your location']
      } else {
            conv.close('We need your location to get reports nearby')
      }
      const options = {
            context,
            permissions,
      }
      conv.ask(new Permission(options))
})

app.intent('reports near me permission_callback', (conv, params, granted) => {
      if (granted) {
            const { location } = conv.device
            const { latitude, longitude } = location.coordinates
            console.log("TAG", location.city, location.coordinates, location.formattedAddress, location.name, location.placeId)
            console.log("TAG", latitude, longitude)

            conv.data.loc = conv.device.location.coordinates
            conv.data.latitude = latitude
            conv.data.longitude = longitude

            return new Promise((resolve, reject) => getNearByReports(conv, resolve))
      }
})

app.intent('ask for push notification', conv => {
      conv.ask(new UpdatePermission({
            intent: 'push notification'
      }))
})

app.intent('push_notifications_granted', conv => {
      if (conv.arguments.get('PERMISSION')) {
            const updatesUserId = conv.arguments.get('UPDATES_USER_ID')
            console.log('TAG', updatesUserId)
            conv.close(updatesUserId)
      }
})

function getNearByReports(conv, resolve) {
      const ONE_KM_APPROXIMATE = 0.008162097402023085

      conv.data.inReports = []
      db.collection('reports').where('verified', '==', true).get()
            .then(docSnaps => {
                  docSnaps.forEach(docSnap => {
                        docSnap = docSnap.data()
                        console.log(docSnap)

                        function inReport(p1_lat, p1_lon, p2_lat, p2_lon) {
                              if (Math.sqrt(Math.pow((p1_lat - p2_lat), 2) + Math.pow(p1_lon - p2_lon, 2)) <= 10 * ONE_KM_APPROXIMATE) {
                                    console.log(true, Math.sqrt(Math.pow((p1_lat - p2_lat), 2) + Math.pow(p1_lon - p2_lon, 2)), p1_lat, p1_lon, p2_lat, p2_lon)
                                    return true
                              } else {
                                    console.log(false, Math.sqrt(Math.pow((p1_lat - p2_lat), 2) + Math.pow(p1_lon - p2_lon, 2)), p1_lat, p1_lon, p2_lat, p2_lon)
                                    return false
                              }
                        }

                        if (docSnap.loc._lat) {
                              if (inReport(conv.data.loc.latitude, conv.data.loc.longitude, docSnap.loc._lat, docSnap.loc._long)) {
                                    conv.data.inReports.push(docSnap)
                              }
                        } else if (docSnap.loc._latitude) {
                              if (inReport(conv.data.loc.latitude, conv.data.loc.longitude, docSnap.loc._latitude, docSnap.loc._longitude)) {
                                    conv.data.inReports.push(docSnap)
                              }
                        }
                  })

                  function getListItems(conv) {
                        var x = {}
                        conv.data.inReports.forEach((inReport, i) => {
                              x[`KEY_${i}`] = {
                                    title: inReport.report_type,
                                    description: inReport.report
                              }
                        })
                        console.log(x)
                        return x
                  }

                  if (conv.data.inReports.length >= 2 && conv.data.inReports.length < 30) {
                        var response = new List({
                              title: 'Reports nearby',
                              items: getListItems(conv)
                        })
                        conv.close(new SimpleResponse({
                              speech: "These are the reports nearby",
                              text: "These are the reports nearby"
                        }))
                        conv.close(response)
                  } else {
                        conv.close("No reports nearby!")
                  }

                  resolve()
                  return null
            })
            .catch(err => { throw err })
}

exports.areaAlert = functions.https.onRequest(app)