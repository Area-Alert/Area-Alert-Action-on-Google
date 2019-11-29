'use strict'

const {
      dialogflow,
      Permission,
      Suggestions,
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
      conv.ask(new SimpleResponse({
            speech: 'Welcome!, Say make a report to make a report?',
            text: "Click 'make a report' to make a report!"
      }))
      conv.ask(new Suggestions(['Make a Report', 'Cancel']))
})

app.intent('Make Report', (conv) => {
      const permissions = ['NAME']
      let context = 'To address you by name'
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
      conv.ask(`Great, Please tell us if people were injured and do they need medical attention?`)

      conv.data.report['moreDetails'] = true
})

app.intent('no - more details', conv => {
      conv.data.report['moreDetails'] = false

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

app.intent('')

exports.areaAlert = functions.https.onRequest(app)