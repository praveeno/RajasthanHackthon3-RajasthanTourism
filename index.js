'use strict';

const functions = require('firebase-functions'); // Cloud Functions for Firebase library
const DialogflowApp = require('actions-on-google').DialogflowApp; // Google Assistant helper library
const request = require('request');
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
  if (request.body.result) {
    processV1Request(request, response);
  } else {
    console.log('Invalid Request');
    return response.status(400).end('Invalid Webhook Request (expecting v1 or v2 webhook request)');
  }
});
/*
* Function to handle v1 webhook requests from Dialogflow
*/
function processV1Request (request, response) {
  let action = request.body.result.action; // https://dialogflow.com/docs/actions-and-parameters
  let parameters = request.body.result.parameters; // https://dialogflow.com/docs/actions-and-parameters
  let inputContexts = request.body.result.contexts; // https://dialogflow.com/docs/contexts
  let requestSource = (request.body.originalRequest) ? request.body.originalRequest.source : undefined;
  const googleAssistantRequest = 'google'; // Constant to identify Google Assistant requests
  const app = new DialogflowApp({request: request, response: response});
  // Create handlers for Dialogflow actions as well as a 'default' handler
  const actionHandlers = {
    // The default welcome intent has been matched, welcome the user (https://dialogflow.com/docs/events#default_welcome_intent)
    'input.welcome': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse('Hello, google user Welcome to my Dialogflow agent!'); // Send simple response to user
      } else {
        sendResponse('Hello, Welcome to my Dialogflow agent!'); // Send simple response to user
      }
    },
    'scheduler': () => {
      let place = parameters.place[0];
      let duration = parameters.duration[0];
      let plaace = jsonOfInfo[place] || jsonOfInfo['default']
      let info = plaace[duration.amount] || plaace[7];
      info.displayText = info.speech + ' ' + info.data.join(' => ');
      
      if (requestSource === googleAssistantRequest) {
        if(duration.unit == 'day') {
          sendGoogleResponse(info);
        } else if(duration.unit == 'min' || duration.unit == 's' || duration.unit == 'h') {
          sendGoogleResponse("a journey cant start in hours");
        } else if(duration.unit == 'yr' || duration.unit == 'mo') {
          sendGoogleResponse("may be you buy a house there");
        } else if(duration.unit == 'wk') {
          sendGoogleResponse(jsonOfInfo[place][7]);
        } else {
          sendGoogleResponse("not know your duration");
        }
         // Send simple response to user
      } else {
        if(duration.unit == 'day') {
          console.log(info);
          sendResponse(info);
        } else if(duration.unit == 'min' || duration.unit == 's' || duration.unit == 'h') {
          sendResponse("a journey cant start in hours");
        } else if(duration.unit == 'yr' || duration.unit == 'mo') {
          sendResponse("may be you buy a house there");
        } else if(duration.unit == 'wk') {
          sendResponse(jsonOfInfo[place][7]);
        } else {
          sendResponse("not know your duration");
        }
      }
    },
    'weather': () => {
      const searchtext = "select item.condition from weather.forecast where woeid in (select woeid from geo.places(1) where text='" + parameters.address.city + "') and u='c'"
      const url = "https://query.yahooapis.com/v1/public/yql?q=" + searchtext + "&format=json"
      request.post(url, {json: true, body: ''}, function(err, res, body) {
        if (!err && res.statusCode === 200) {
          const temp = body.query.results.channel.item.condition.temp 
          const text = body.query.results.channel.item.condition.text
          if (requestSource === googleAssistantRequest) {
            sendGoogleResponse('temprature of '+parameters.place+'is '+temp+'with'+text); // Send simple response to user
          } else {
            sendResponse('temprature of '+parameters.place+'is '+temp+'with'+text + body); // Send simple response to user
            //'
          }
        }
    });
    },
    // The default fallback intent has been matched, try to recover (https://dialogflow.com/docs/intents#fallback_intents)
    'input.unknown': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse('I\'m having trouble, can you try that again?'); // Send simple response to user
      } else {
        sendResponse('I\'m having trouble, can you try that again?'); // Send simple response to user
      }
    },
    // Default handler for unknown or undefined actions
    'default': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        let responseToUser = {
          //googleRichResponse: googleRichResponse, // Optional, uncomment to enable
          //googleOutputContexts: ['weather', 2, { ['city']: 'rome' }], // Optional, uncomment to enable
          speech: 'This message is from Dialogflow\'s Cloud Functions for Firebase editor!', // spoken response
          text: 'This is from Dialogflow\'s Cloud Functions for Firebase editor! :-)' // displayed response
        };
        sendGoogleResponse(responseToUser);
      } else {
        let responseToUser = {
          //data: richResponsesV1, // Optional, uncomment to enable
          //outputContexts: [{'name': 'weather', 'lifespan': 2, 'parameters': {'city': 'Rome'}}], // Optional, uncomment to enable
          speech: 'This message is from Dialogflow\'s Cloud Functions for Firebase editor!', // spoken response
          text: 'This is from Dialogflow\'s Cloud Functions for Firebase editor! :-)' // displayed response
        };
        sendResponse(responseToUser);
      }
    }
  };
  // If undefined or unknown action use the default handler
  if (!actionHandlers[action]) {
    action = 'default';
  }
  // Run the proper handler function to handle the request from Dialogflow
  actionHandlers[action]();
    // Function to send correctly formatted Google Assistant responses to Dialogflow which are then sent to the user
  function sendGoogleResponse (responseToUser) {
    if (typeof responseToUser === 'string') {
      app.ask(responseToUser); // Google Assistant response
    } else {
      // If speech or displayText is defined use it to respond
      let googleResponse = app.buildRichResponse().addSimpleResponse({
        speech: responseToUser.speech || responseToUser.displayText,
        displayText: responseToUser.displayText || responseToUser.speech
      });
      // Optional: Overwrite previous response with rich response
      if (responseToUser.googleRichResponse) {
        googleResponse = responseToUser.googleRichResponse;
      }
      // Optional: add contexts (https://dialogflow.com/docs/contexts)
      if (responseToUser.googleOutputContexts) {
        app.setContext(...responseToUser.googleOutputContexts);
      }
      console.log('Response to Dialogflow (AoG): ' + JSON.stringify(googleResponse));
      app.ask(googleResponse); // Send response to Dialogflow and Google Assistant
    }
  }
  // Function to send correctly formatted responses to Dialogflow which are then sent to the user
  function sendResponse (responseToUser) {
    // if the response is a string send it as a response to the user
    if (typeof responseToUser === 'string') {
      let responseJson = {};
      responseJson.speech = responseToUser; // spoken response
      responseJson.displayText = responseToUser; // displayed response
      response.json(responseJson); // Send response to Dialogflow
    } else {
      // If the response to the user includes rich responses or contexts send them to Dialogflow
      let responseJson = {};
      // If speech or displayText is defined, use it to respond (if one isn't defined use the other's value)
      responseJson.speech = responseToUser.speech || responseToUser.displayText;
      responseJson.displayText = responseToUser.displayText || responseToUser.speech;
      // Optional: add rich messages for integrations (https://dialogflow.com/docs/rich-messages)
      responseJson.data = responseToUser.data;
      // Optional: add contexts (https://dialogflow.com/docs/contexts)
      responseJson.contextOut = responseToUser.outputContexts;
      console.log('Response to Dialogflow: ' + JSON.stringify(responseJson));
      response.json(responseJson); // Send response to Dialogflow
    }
  }
}
// Construct rich response for Google Assistant (v1 requests only)
const app = new DialogflowApp();
function sendRichGoogleResponce(title, card, no) {
  const googleRichResponse = app.buildRichResponse()
      .addSimpleResponse(card)
      .addSuggestions(title)
      .addSuggestions([title])
      .addSuggestionLink('route', 'https://praveeno.github.io/RajasthanHackthon3-RajasthanTourism/' + no);
      
 
  app.ask(googleRichResponse);
}

const jsonOfInfo = {
    "udaipur" : {
        "1" : {
            "displayText" : "",
            "speech" : "In a short duration of one day, you can visit City Palace, Sajjangarh Fort, and Fatehsagar Lake. Here's a helpful route, I planned for you. Hope you like this.",
            "data" : ["https://maps.app.goo.gl/i/mAV_T"]
        },
        "2" : {
            "displayText" : "",
            "speech" : "Great choice! In two days, you can visit most of the attractions at Udaipur city, such as, City Palace, Sajjangarh Fort, Fatehsagar lake and Nimach mata, Shilpgram, Pichhola lake and karni mata, Lok kala mandal, jagdish Temple, Gulab bagh, Sukhadia Circle and the youth's favorite - Ambrai Ghat. Here's a helpful route, I planned for you. Hope you like this.",
            "data" : ["https://maps.app.goo.gl/i/xpfWL", "https://maps.app.goo.gl/i/NEJVI"]
        },
        "3" : {
            "displayText" : "",
            "speech" : "Well, in three days, you can visit all the attractions at Udaipur plus some more nearby places such as Shreenath ji and Haldi ghati or you may also choose to visit Kundeshwar Mahadeo and Jaisamand lake. Here's a helpful route, I planned for you. Hope you like this.",
            "data" : ["https://maps.app.goo.gl/i/mAV_T", "https://maps.app.goo.gl/i/E8iSO", "https://maps.app.goo.gl/i/mW4Hi"]
        },
        "4" : {
            "displayText" : "",
            "speech" : "Extending your visit to chittorgarh would be my best advice to you once you completed your trip to Udaipur in your four days trip. Here's a helpful route, I planned for you. Hope you like this.",
            "data" : ["https://maps.app.goo.gl/i/mAV_T", "https://maps.app.goo.gl/i/E8iSO", "https://maps.app.goo.gl/i/mW4Hi", "https://maps.app.goo.gl/i/O9w2k"]
        },
        "5" : {
            "displayText" : "",
            "speech" : "Five days, huh. You can see all the in-city attractions here at udaipur plus you can extend your trip to vagad, which has Dungarpur and Banswara. Here's a helpful route, I planned for you. Hope you like this.",
            "data" : ["https://maps.app.goo.gl/i/xpfWL", "https://maps.app.goo.gl/i/NEJVI", "https://maps.app.goo.gl/i/E8iSO", "https://maps.app.goo.gl/i/w0vA8", "https://maps.app.goo.gl/i/WsCNW"]
        },
        "6" : {
            "displayText" : "",
            "speech" : "For your six days trip to udaipur city, I would advice you to visit Udaipur, haldi ghati, Kumbhalgarh Fort, Rajsamand, and Pali. Here's a helpful route, I planned for you. Hope you like this.",
            "data" : ["https://maps.app.goo.gl/i/xpfWL", "https://maps.app.goo.gl/i/NEJVI", "https://maps.app.goo.gl/i/E8iSO", "https://maps.app.goo.gl/i/bycvr", "https://maps.app.goo.gl/i/P4yQI"]
        },
        "7" : {
            "displayText" : "",
            "speech" : "This is the best choice! One whole week dedicated to non-deserty Rajasthan! I'd strongly suggest you visiting Mount abu as your trip to udaipur. Here's a helpful route, I planned for you. Hope you like this.",
            "data" : ["https://maps.app.goo.gl/i/xpfWL", "https://maps.app.goo.gl/i/NEJVI", "https://maps.app.goo.gl/i/E8iSO", "https://maps.app.goo.gl/i/zFi80"]
        }
    },
    "default" : {
        "1" : {
            "displayText" : "",
            "speech" : "sorry, no data",
            "data" : []
        },
        "2" : {
            "displayText" : "",
            "speech" : "sorry, no data",
            "data" : []
        },
        "3" : {
            "displayText" : "",
            "speech" : "sorry, no data",
            "data" : []
        },
        "4" : {
            "displayText" : "",
            "speech" : "sorry, no data",
            "data" : []
        },
        "5" : {
            "displayText" : "",
            "speech" : "sorry, no data",
            "data" : []
        },
        "6" : {
            "displayText" : "",
            "speech" : "sorry, no data",
            "data" : []
        },
        "7" : {
            "displayText" : "",
            "speech" : "sorry, no data",
            "data" : []
        }
    }
}