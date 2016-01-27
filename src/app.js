//Show which agency is selected on settings page.
var UI = require('ui');
var Vector2 = require('vector2');
var ajax = require('ajax');
var Settings = require('settings');
var lat, lon;
var agency = localStorage.getItem('agency');
var agencies =  [];
var routeList = JSON.parse(localStorage.getItem('routeList')) || [];
var stopList = localStorage.getItem('stopList') ? JSON.parse(localStorage.getItem('stopList')) : [];
var nearbyStops = [];
var messages = [];
var currentRoute = 0;
//localStorage.setItem('forceCache',1);
var forceCache = localStorage.getItem('forceCache') ? localStorage.getItem('forceCache') : '1';
var nearbyCounter = 0;
var checkCounter = 0;
var removeCounter = 0;
var seekDistance = 350;
var id;

var reset = function(){
  routeList = [];
  stopList = [];
  localStorage.removeItem('routeList');
  localStorage.removeItem('stopList');
};

Settings.config(
  { url: 'www.stanica.ca/robertbus.html' },
  function(e) {
  },
  function(e) {
    if(!e.failed){
      console.log("Settings accepted");
      agency = JSON.parse(JSON.stringify(e.options)).agency;
      localStorage.setItem('agency', agency);
      forceCache = JSON.parse(JSON.stringify(e.options)).forceCache;  
      localStorage.setItem('forceCache', forceCache);
      if(forceCache === "1"){
        reset();
      }
      getLocation();
    }
    else {
       console.log("Cancelled");
    }
  }
);

Math.radians = function(degrees) {
  return degrees * Math.PI / 180;
};

// http://www.movable-type.co.uk/scripts/latlong.html
var distance = function (lat1, lon1, lat2, lon2){
  var R = 6371000; // metres
  var φ1 = Math.radians(lat1);
  var φ2 = Math.radians(lat2);
  var Δφ = Math.radians((lat2-lat1));
  var Δλ = Math.radians((lon2-lon1));
  
  var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
};

var simpleDistance = function (lat1, lon1, lat2, lon2){
  var R = 6371000; // metres
  var φ1 = Math.radians(lat1);
  var φ2 = Math.radians(lat2);
  var λ1 = Math.radians(lon1);
  var λ2 = Math.radians(lon2);
  var x = (λ2-λ1) * Math.cos((φ1+φ2)/2);
  var y = (φ2-φ1);
  return Math.sqrt(x*x + y*y) * R;
};

var simplerDistance = function (lat1, lon1, lat2, lon2){
  var R = 6371000; // metres
  var φ1 = Math.radians(lat1);
  var φ2 = Math.radians(lat2);
  var Δλ = Math.radians((lat2-lat1));
  return Math.acos( Math.sin(φ1)*Math.sin(φ2) + Math.cos(φ1)*Math.cos(φ2) * Math.cos(Δλ) ) * R;
};

var loadingWindow = new UI.Window();
var loadingText = new UI.Text({
  position: new Vector2(0,40),
  size: new Vector2(144,30),
  font: 'gothic-24-bold',
  text: 'Downloading 0%',
  textAlign: 'center'
});
if (stopList.length > 0){
  loadingText.text("Loading...");
}
loadingWindow.add(loadingText);

var getPredictions = function(stopTag, routeTag) {
  ajax(
    {
      url: "https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20xml%20where%20url%3D'http%3A%2F%2Fwebservices.nextbus.com%2Fservice%2FpublicXMLFeed%3Fcommand%3Dpredictions%26a%3D"+agency+"%26s%3D"+stopTag+"%26r%3D"+routeTag+"%26useShortTitles%3Dtrue'&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=",
      method: 'get'
    },
    function(data) {
      var busTitle, busTitleText, predictionTime, minutes, seconds;
      var times = [];
      var predictionWindow = new UI.Window();
      predictionWindow.scrollable(true);
      var stopTitle = JSON.parse(data).query.results.body.predictions.stopTitle;
      var direction = JSON.parse(data).query.results.body.predictions.direction;
      var stopTitleText = new UI.Text({
        position: new Vector2(0,0),
        size: new Vector2(144,20),
        font: 'gothic-14-bold',
        text: stopTitle.split(' At ')[1] ? stopTitle.split(' At ')[1] : stopTitle,
        textAlign: 'center'
      });
      predictionWindow.add(stopTitleText);
      if (direction.length > 1){
        for (var x=0; x<direction.length; x++){
          busTitle = direction[x].title;
          busTitleText = new UI.Text({
            position: new Vector2(5,35 + (60  * x)),
            size: new Vector2(144,20),
            font: 'gothic-14',
            text: busTitle + ':',
            textAlign: 'left'  
          });
          predictionWindow.add(busTitleText);
          predictionTime = new UI.Text();
          times = [];
          for (var y=0; y<2; y++){
            minutes = direction[x].prediction[y].minutes;
            seconds = direction[x].prediction[y].seconds - (minutes * 60);
            if (seconds < 10){
              seconds = '0' + seconds;
            } 
            if (minutes < 10){
               minutes = '0' + minutes;
            }
            times.push(minutes + ':' + seconds);
          }
          predictionTime = new UI.Text({
            position: new Vector2(0,65 + (60 * x)),
            size: new Vector2(139,20),
            font: 'gothic-24-bold',
            text: times[0] + " and " + times[1],
            textAlign: 'right'
          });
          predictionWindow.add(predictionTime);
        }
      }
      else {
        busTitle = direction.title;
        busTitleText = new UI.Text({
          position: new Vector2(5,35),
          size: new Vector2(144,20),
          font: 'gothic-14',
          text: busTitle + ':',
          textAlign: 'left'  
        });
        predictionWindow.add(busTitleText);
        predictionTime = new UI.Text();
        times = [];
        for (var z=0; z<2; z++){
          minutes = direction.prediction[z].minutes;
          seconds = direction.prediction[z].seconds - (minutes * 60);
          if (seconds < 10){
            seconds = '0' + seconds;
          } 
          if (minutes < 10){
             minutes = '0' + minutes;
          }
          times.push(minutes + ':' + seconds);
        }
        predictionTime = new UI.Text({
          position: new Vector2(0,65),
          size: new Vector2(139,20),
          font: 'gothic-24-bold',
          text: times[0] + " and " + times[1],
          textAlign: 'right'
        });
        predictionWindow.add(predictionTime);
      }
      loadingWindow.hide();
      predictionWindow.show();
    },
    function(error) {
      console.log('Failed fetching route data: ' + error);
    }
  );
};

var checkStops = function(maxLength, stopTag, routeTag){
  ajax(
      {
        url: "https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20xml%20where%20url%3D'http%3A%2F%2Fwebservices.nextbus.com%2Fservice%2FpublicXMLFeed%3Fcommand%3Dpredictions%26a%3D"+agency+"%26s%3D"+stopTag+"%26r%3D"+routeTag+"%26useShortTitles%3Dtrue'&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=",
        method: 'get',
        async: true
      },
      function(data) {
        if (JSON.parse(data).query.results.body.predictions.message && JSON.parse(data).query.results.body.predictions.message.priority === "Critical"){
          messages.push("Route " + routeTag + ":\n" +JSON.parse(data).query.results.body.predictions.message.text + "\n\n");
        }
        if (JSON.parse(data).query.results.body.predictions.direction === undefined){
          nearbyStops.splice(removeCounter, 1);
        }
        else {
          removeCounter++;
        }
        checkCounter++;
        if (checkCounter === maxLength){
          var sections = [];
          var items = [];
          for (var t=0; t<nearbyStops.length; t++){
            if(nearbyStops[t][0] !== undefined){
              for (var s=0; s<nearbyStops[t].length; s++){
                items.push({
                  title: nearbyStops[t][s].distance.toFixed(1) + ' meters',
                  subtitle: nearbyStops[t][s].title.split(' At ')[1] ? nearbyStops[t][s].title.split(' At ')[1] : nearbyStops[t][s].title,
                  tag: nearbyStops[t][s].tag,
                  routeTag: nearbyStops[t][s].routeTag
                });
              }
              sections.push({
                title: nearbyStops[t][0].route,
                items: items
              });
              items = [];
            }
          }
          loadingText.text('Loading...');
          if (sections.length > 0){
            menu.sections(sections);
          }
          else {
            menu = new UI.Menu({
              sections: [{
                title: 'No Routes found',
                items: [{
                  title: 'No Route',
                  subtitle: 'Read the message.',
                }]
              }]
            });
          }
          menu.show();
          if (messages.length > 0){
            loadingWindow.remove(loadingText);
            loadingText = new UI.Text({
              position: new Vector2(10,10),
              size: new Vector2(134,300),
              font: 'gothic-14',
              text: messages.join(""),
              textAlign: 'left'
            });
            loadingWindow.scrollable(true);
            loadingWindow.add(loadingText);
            loadingWindow.show();
          }
        }
        else {
          checkStops(maxLength, nearbyStops[removeCounter][0].tag, nearbyStops[removeCounter][0].routeTag);
        }
      },
      function(error){
        console.log('Failed fetching route data: ' + error);
      }
    );
};

var getStops = function() {
  if (stopList.length === 0 || forceCache === '1'){
     ajax(
      {
        url: "https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20xml%20where%20url%3D'http%3A%2F%2Fwebservices.nextbus.com%2Fservice%2FpublicXMLFeed%3Fcommand%3DrouteConfig%26a%3D"+agency+"%26r%3D"+routeList[currentRoute]+"'&format=json&callback=",
        method: 'get',
        async: true
      },
      function(data) {
        //console.log('Looking at route: ' + routeList[currentRoute], "stopList length:"+ stopList.length);
        if (JSON.parse(data).query.results !== null){
          var stopLength = JSON.parse(data).query.results.body.route.stop.length;
          stopList[parseInt(currentRoute)] = [];
          for (var y=0; y<stopLength; y++){
            stopList[parseInt(currentRoute)].push({
              lat: JSON.parse(data).query.results.body.route.stop[y].lat,
              lon: JSON.parse(data).query.results.body.route.stop[y].lon,
              tag: JSON.parse(data).query.results.body.route.stop[y].tag,
              title: JSON.parse(data).query.results.body.route.stop[y].title,
              route: JSON.parse(data).query.results.body.route.title,
              routeTag: JSON.parse(data).query.results.body.route.tag,
            });
          }
          if (currentRoute+1 < routeList.length){
            currentRoute++;
            loadingText.text('Downloading ' + Math.floor(currentRoute/routeList.length * 100) + '%');
            setTimeout(function(){getStops();}, 150);
          }
          else {
            localStorage.removeItem('stopList');
            localStorage.setItem('stopList', JSON.stringify(stopList));
            forceCache = '0';
            localStorage.setItem('forceCache', '0');
            getStops();
          }
        }
        else {
          console.log('Server returned null');
          setTimeout(function(){getStops();}, 500);
        }
      },
      function(error){
        console.log('Failed fetching route data: ' + error);
        loadingText.text("Network error. Close app and try again.");
      }
    );
  }
  else {
    var found = false;
    nearbyCounter = 0;
    currentRoute = 0;
    for (var x=0; x<routeList.length; x++){
      nearbyStops[nearbyCounter] = [];
      for (var y=0; y<stopList[x].length; y++){
        var stopDistance = distance(lat, lon, stopList[x][y].lat, stopList[x][y].lon);
        if (stopDistance <= seekDistance){
          nearbyStops[nearbyCounter].push({
            lat: stopList[x][y].lat,
            lon: stopList[x][y].lon,
            tag: stopList[x][y].tag,
            title: stopList[x][y].title,
            route: stopList[x][y].route,
            routeTag: stopList[x][y].routeTag,
            distance: stopDistance
          });
          found = true;
        }
      }
      if (found){
        nearbyStops[nearbyCounter].sort(function(a,b){
          return a.distance - b.distance;
        });
        nearbyCounter++;
        found = false;
      }
    }
    nearbyStops.splice(nearbyStops.length-1,1);
    checkCounter = 0;
    removeCounter = 0;
    if (nearbyCounter > 0){
      checkStops(nearbyStops.length, nearbyStops[removeCounter][0].tag, nearbyStops[removeCounter][0].routeTag);  
    }
    else{
      loadingText.text('No nearby stops found.');
    }
  }
};

var getRouteList = function() {
    ajax(
      {
        url: 'https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20xml%20where%20url%3D%22http%3A%2F%2Fwebservices.nextbus.com%2Fservice%2FpublicXMLFeed%3Fcommand%3DrouteList%26a%3D'+agency+'%22%20&format=json&callback=',
        method: 'get',
        async: 'false'
      },
      function(data) {
        var routeListLength = JSON.parse(data).query.results.body.route.length;
        for (var x=0; x<routeListLength; x++){
          routeList[x] = JSON.parse(data).query.results.body.route[x].tag;
        }
        localStorage.setItem('routeList', JSON.stringify(routeList));
        getStops();
      },
      function(error){
        console.log('Failed fetching route data: ' + error);
      }
    );
};

var getAgencies = function () {
  ajax(
    {
      url: 'https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20xml%20where%20url%3D%22http%3A%2F%2Fwebservices.nextbus.com%2Fservice%2FpublicXMLFeed%3Fcommand%3DagencyList%22%20%0A&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=',
      method: 'get'
    },
    function(data) {
      var agencyLength = JSON.parse(data).query.results.body.agency.length;
      for (var x=0; x<agencyLength; x++){
        agencies.push(JSON.parse(data).query.results.body.agency[x].tag);
        console.log("<option value=\"" + JSON.parse(data).query.results.body.agency[x].tag+"\">" + JSON.parse(data).query.results.body.agency[x].regionTitle + " (" + JSON.parse(data).query.results.body.agency[x].tag +  ")</option>");
      }
      localStorage.setItem('agencies', agencies);
    },
    function(error) {
      console.log('Failed fetching route data: ' + error);
    }
  );
};

var getLocation = function () {
  var runOnce = false;
  var locationOptions = {
    enableHighAccuracy: true, 
    maximumAge: 0, 
    timeout: 10000
  };
  
  function locationSuccess(pos) {
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
    //console.log(lat, lon);
    //lat = 43.8032825; //home
    //lon = -79.4074543; //home
    //lat = 43.7869199;
    //lon = -79.41716;
    //lat = 48.4435486; //thunderbay
    //lon = -89.2578602; //thunderbay
    setTimeout(function(){
       navigator.geolocation.clearWatch(id);
      if (!runOnce){
        runOnce = true;
        if(routeList.length <= 1 || forceCache === '1'){
          routeList = [];
          getRouteList();
        }
        else {
          getStops();
        }
      }
    }, 1000);
   
  }
  
  function locationError(err) {
    console.log('location error (' + err.code + '): ' + err.message);
  }
  
  // Make an asynchronous request
  id = navigator.geolocation.watchPosition(locationSuccess, locationError, locationOptions);
};

//agency = "ttc"
if (agency !== 'undefined' && agency !== null && agency !== "None"){
  loadingWindow.show();
  getLocation();
}
else {
  loadingText.text("Configure from app settings.");
  loadingWindow.show();
}
   
var menu = new UI.Menu({
  sections: [{
    title: "Routes",
    items: ''
  }]
});
  menu.on('select', function(e) {
    loadingWindow.show();
    getPredictions(e.item.tag, e.item.routeTag);
  });