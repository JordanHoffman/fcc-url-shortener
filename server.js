/*TODO: Handle showing the user the shortened URL as well as the code to make the shortURL redirect to the actual website. Also handle the return JSON object for invalid website.
*/

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var bodyParser = require('body-parser')
var dns = require('dns')

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true }).catch(error => {console.log("Howdy, here's the error: " + error)});

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
app.use(bodyParser.urlencoded({extended: false}))

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

var Schema = mongoose.Schema;
//in the Schema, strict is set to false to allow the Counter Doc to be added since it doesnt match the Schema
var websiteSchema = new Schema({
  fullIP: {
    type: String
  },
  fullURL: {
    type: String
  },
  shortenedURL: {
    type: String
  }
}, {collection: "websites", strict: false})

var Website = mongoose.model('Website', websiteSchema)

//Uncomment this to remove all docs
// Website.remove({}, function(err, data){
//   if (err) console.log("error removing all docs" + err)
// })

app.get('/api/shorturl/:shortNumber', (req, res)=>{
  Website.findOne({shortenedURL : req.params.shortNumber}).then(function(doc)
  {
    console.log(doc)
    if(doc){
      res.redirect(doc.fullURL)
    }
    else {
      res.json({"error": "No short url found for given input"})
    }
  })
})

app.post("/api/shorturl/new", function (req, res) {
  //get rid of the protocol (https:// part of the URL since it can screw up the dns.lookup for some reason)
  let urlInput = req.body.url
  var pattern = /^((http|https):\/\/)/;
  var hasHttpsBeginning = urlInput.match(pattern)
  console.log("REGEX TESTING: " + hasHttpsBeginning)
  let urlNoProtocol = urlInput.replace(/(^\w+:|^)\/\//, '');
  console.log(urlInput + "  " + urlNoProtocol)

  dns.lookup(urlNoProtocol, (err, address, family)=>{
    //err occurs if it's not a valid or existing website
    if (err || !hasHttpsBeginning){
      console.log(err)
      res.json({"error":"invalid URL"})
    }
    //The URL is valid, so now handle the db stuff 
    else 
    {
      console.log("UrlInput: " + urlInput + " exists! Returned as: " + address + "of type: " + typeof(address))
      
      var findWebsite = Website.findOne({fullURL : urlInput})
      
      findWebsite.then(function(doc)
      {
        //The website exists in the db, so just get its shortURL
        if (doc){
          console.log("this IP address: " + address + " was found in db for the URL: " + urlInput + ". Here is the type of doc returned: " + typeof(doc) + " and its contents: " + doc)
          res.json({"original url": doc.fullURL, "short_url": doc.shortenedURL})
        }
        //The website doesn't exist in the db, so add it with a unique shortURL
        else
        {
          console.log("this address: " + address + " was NOT found in db for the URL: " + urlInput)
          
          //{new: true} option returns the updated Counter Doc to give the next new unique ID for the website
          var findOrCreateCounter = Website.findOneAndUpdate
          (
            {uniqueURLCounter: "Unique Counter Doc"}, 
            {
              $inc: {uniqueShortURLNumber: 1}, 
              $set: {uniqueURLCounter: "Unique Counter Doc"}
            }, 
            {upsert: true, new: true}
          )
          
          findOrCreateCounter.then(function(doc)
          {
            
            var testWebsite = new Website(
            {
              fullIP: address, 
              fullURL: urlInput,
              shortenedURL: doc._doc.uniqueShortURLNumber
            })
            
            testWebsite.save(function(err, data) 
            {
              if (err){console.log("Error saving new website: " + err)}
              else {
                console.log("New Website added: " + data)
                res.json({"original url": data.fullURL, "short_url": data.shortenedURL})
              } 
            })
            
          }).catch(function(err){
            console.log("error finding/creating Counter: " + err)
          })  
        }//end of else statement for finding website in db
      }).catch(function(err){
        console.log("error finding address in DB: " + err)
      })
    }
  })
});

app.listen(port, function () {
  console.log('Node.js listening ...');
});