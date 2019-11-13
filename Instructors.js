const querystring = require('querystring');
const express = require('express')
const sqlite3 = require('sqlite3');
const app = express()
const port = 1000


// Ariel add from here
const passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var ensureLogin = require('connect-ensure-login');

passport.use(new LocalStrategy(
    {
        usernameField: 'username',
        passwordField: 'password'
    },
    // added async and query
    async (username, password, doneCallback) => {
        //TODO: check if the user and the password are OK
        //For now only support Yaniv/king

        // check user\pw against db:
        let ret = await query("select * from users where username = \"" + username + "\"");

        if (ret.length > 0 && ret[0].password == password) {
            // login success!
            return doneCallback(null, { name: username, id: ret[0].id });
        }
        else {
            // login failure!
            return doneCallback("Error! wrong user and/or password!", null);
        }

        /*
        if (username === 'yaniv' && password === 'king') 
        {
            return doneCallback(null, {id: username})
        } 
    
        //failure
        return doneCallback("Error! wrong user and/or password", null);
        */
    }));

//methods to serialize the user and deserialize it
passport.serializeUser((user, callback) => callback(null, user.id));

passport.deserializeUser((id, callback) => {
    //retrieve whatever info from somewhere (e.g. DB), by id and return what ever you want more
    callback(null, { id: id });
});

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }))
app.use(expressSession({
    secret: 'some-secret',
    resave: true,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/login', (req, res) => {
/*    
    res.send(`
<form action="/login" method="post">
    <div>
        <label>Username:</label>
        <input type="text" name="username"/>
    </div>
    <div>
        <label>Password:</label>
        <input type="password" name="password"/>
    </div>
    <div>
        <input type="submit" value="Log In"/>
    </div>
</form>
`)
*/
res.sendFile(__dirname+"/html/Login.html");
});

app.post('/login', passport.authenticate('local', {
    successReturnToOrRedirect: '/good-login',
    failureRedirect: '/login'
}));

//this rule will verify that any call has prerequisite of login other than what's above...
// which is login get and post only
app.use('/', ensureLogin.ensureLoggedIn('/login'), (req, res, next) => next());

app.use('/', (req, res, next) => {
    //log the current user:
    console.log("THE USER:" + JSON.stringify(req.user));
    next();
});
///////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/good-login', async (req, res) => {
    res.write("<html dir='rtl' lang='heb'><meta charset=\"utf-8\"><p>הצלחת להיכנס למערכת! :-)</p></html>");
    res.send();
});

///////////////////////////////////////////////////////////////////////////////////////////////////////
// Ariel add until here
/*
app.get('/html/re-activateUsers.html', async (req, res) => {

    //check if user has privileges...
    var t = 8;
    var user = req.user.id;

    var userRights = await query("select admin from users where id="+user);

    if (!userRights[0].admin)
    {
        res.status(401).redirect("/login");
        
    }
    else
    {
        next();
        //app.use('/html', express.static('re-activateUsers.html'));
    }
});
*/
app.use('/html', express.static('html'));


console.log("starting Instructors.js...");

let db = new sqlite3.Database('Participation.db', (err) => {
    if (err) 
    {
        console.log("error connecting to db...");
    }
});
console.log("db connection established!");
////////////////////////////////////////////////////////////////////////////////////////////////////
function randomString(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// function query
async function query(queryStr, ...params) {
    try {
        return new Promise((resolve, reject) => db.all(queryStr, ...params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        }))
    }
    catch (e) {
        console.log(e);
    }
}

// text in notepad here!
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// logging middleware
var num = 0;
app.use(function (req, res, next) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var method = req.method;
    var url = req.url;

    console.log((++num) + ". IP " + ip + " " + method + " " + url);

    next();
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getParticipationSummary(instID, date)
{

    var ret = await query("select * from participation where instructorid="+instID+" and date='"+date+"' and participated=true");
    var participated = ret.length;

    // now find TOTAL amount of users, then find 'not participated'...
    var total = await query("select DISTINCT ParticipantID from participation where InstructorID = "+instID);
    var notPart = total.length - participated;
    
    var retMsg = "{\"participated\": "+participated+", \"notParticipated\": "+notPart+"}";
        
    return retMsg;
};


/////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/retActivityLink', async (req, res) => 
{
    var ret = await query("select * from users where id="+req.user.id);

    if (ret.length != 1) return;
    if (ret[0].admin == 1)
    {
        // admin users:
        res.write("<p><b><a href=\"/html/re-activateUsers.html?instid=6\" target=\"_blank\">החזר אקטיביות של חניכים</a></b></p>");
    }
    else
    {
        // regular users:
        res.write("");

    }
    res.send();
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/htmlForUsers', async (req, res) => {

    var ret = await query("select * from users where id="+req.user.id);

    if (ret.length != 1) return;
    if (ret[0].admin == 1)
    {
        // admin users:
        res.write("<p>שלום '"+ret[0].username+"'</p><b><a href=\"/html/Participation.html\" target=\"_blank\">צפיה בהשתתפות החניכים שלך</a></b></p>");
    }
    else
    {
        // regular users:
        res.write("<p>שלום '"+ret[0].username+"'</p><b><a href=\"/html/PartUser.html?user="+req.user.id+"\" target=\"_blank\">צפיה בהשתתפות החניכים שלך</a></b></p></html>");

    }
    res.send();
});
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/rakazById', async (req, res) => {
    instructor = req.query.instID;

    let ret = await query("select Name from rakazim where ID = " + instructor);
    res.write("\"" + ret[0].Name + "\"");
    console.log("get name of instructor " + instructor + ", returned: " + ret[0].Name);
    res.send();

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/getInstDates', async (req, res) => {
    var instID = req.query.instID;
    res.header("Content-Type", "text/html; charset=utf-8");

    var sql = "select distinct Date from Participation where InstructorID = " + instID;

    let rows = await query(sql);

    // also add date totals summary:

    var op = "[";
    for (i = 0; i < rows.length; i++) 
    {
        var msg = await getParticipationSummary(instID, rows[i].Date);
        var datesSummary = JSON.parse(msg);
        if (i > 0) op += ", ";
        op += "\{\"date\":\"" + rows[i].Date + "\", \"yes\":\""+datesSummary.participated+"\", \"no\":\""+datesSummary.notParticipated+"\"}";
    }
    op += "]";
    res.write(op);
    res.send();
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/rakazim', async (req, res) => {

    res.header("Content-Type", "text/html; charset=utf-8");

    let rows = await query("select ID, Name from rakazim");

    var op = "[";
    for (let i = 0; i < rows.length - 1; i++) {
        op += "{\"id\":\"" + rows[i].ID + "\"";
        op += ", ";
        op += "\"Name\":\"" + rows[i].Name + "\"}";
        if (i != rows.length - 2) op += ", ";
    }
    op += "]";
    res.write(op);
    res.send();
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/selectInst', async (req, res) => {
    console.log("/selectInst");

    res.header("Content-Type", "text/html; charset=utf-8");
    //res.write(" dir=\"rtl\">");

    try {
        let rows = await query("select distinct district from rakazim");
        console.log("got districts!");

        //res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
        var retStr = "[";
        for (let i = 0; i < rows.length - 1; i++) {
            var currDist = rows[i].District;
            if (currDist.length == 0) continue;
            if (!currDist.replace(/\s/g, '').length) {
                continue;
            }
            retStr += "\"" + currDist + "\"";
            retStr += ((i == rows.length - 2) ? "" : ", ");
        }
        retStr += "]";
        console.log(retStr);
        res.send(retStr);
    }
    catch (e) {
        console.log("failed to retrieve list of districts: " + e);
    }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/yaniv', async (req, res) => {
    res.write("klum");
    res.send();
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/editMembers', async (req, res) => {
    var members = req.query;
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
// get list of in-active users OR re-activate list of users sent...
app.get('/getInactiveUsers', async (req, res) => {
    console.log("getting non-active members or re-activating members.");


    if (typeof req.query["activateUsers"] !== 'undefined') {
        // activation  change!
        var activateUsers = req.query.activateUsers;
        console.log("Re activating users " + activateUsers);
        var reActivateUsers = activateUsers.split(",");

        try {
            var activateSql = "update members set active = 1 where ID in (";
            var numUsers = 0;
            for (i = 0; i < reActivateUsers.length; i++) {
                if (i > 0) activateSql += ", ";
                var userId = reActivateUsers[i].substring(3);
                activateSql += "\"" + userId + "\"";
                numUsers++;
            }
            activateSql += ")";
            let res = await query(activateSql);
        }
        catch (e) {
            console.log("Failed reactivating user/s:\n" + e);
        }
        res.write("<h1>" + numUsers + " users were updated!</h1>")

        //res.write("Users were Re-activated!");
        console.log(activateSql + " \nwas executed!");
        res.send();
    }
    else {
        // no changes. just get list of in-active...
        console.log("listing all in-active users!");
        res.header("Content-Type", "text/html; charset=utf-8");
        let rows = await query("select * from members where active <> 1");

        var retArray = "[";
        try {
            console.log("found " + rows.length + " deactive users!");

            for (i = 0; i < rows.length - 1; i++) {
                if (i > 0) retArray += ", ";
                retArray += "{";
                retArray += "\"name\": \"" + rows[i].FullName + "\", ";
                retArray += "\"memberID\": \"" + rows[i].ID + "\"";
                retArray += "}";
            }
            retArray += "]";

            res.write(retArray);
            res.send();
        }
        catch (e) {
            console.log(e);
        }
    }
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/membersForInstructor', async (req, res) => {
    console.log("getting members for instructor:" + req.query.instID);
    res.header("Content-Type", "text/html; charset=utf-8");
    let rows = await query("select District from rakazim where ID = " + req.query.instID);
    var dist = rows[0].District;

    var q = "select ID, FullName from members where Active = 1 AND סניף='" + dist + "'";
    //let rows = await query("Select * from members where סניף='"+req.query.snif+"'");
    var retArray = "[";
    try {
        let rows2 = await query(q);
        console.log("found " + rows2.length + " rows!");

        for (i = 0; i < rows2.length; i++) {
            if (i > 0) retArray += ", ";
            retArray += "{";
            retArray += "\"name\":\"" + rows2[i].FullName + "\", ";
            retArray += "\"memberID\":" + rows2[i].ID;
            retArray += "}";
        }
        retArray += "]";


    }
    catch (e) {
        console.log(e);
    }


    res.write(retArray);
    res.send();
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/addParticipation', async (req, res) => {
    var params = querystring.parse();
    var queryParams = new Array();

    var instID = req.query.instID;
    var date = req.query.actDate;
    for (i = 1; i < 6000; i++) {
        if (req.query["ID-" + i] != undefined) {
            queryParams[i] = req.query["ID-" + i];
        }
    }
    console.log("found " + queryParams.length + " query params!");

    addSql = "insert into Participation (InstructorID, Date, ParticipantID, participated) VALUES ";
    var firstVal = true;
    for (i = 1; i < 6000; i++) {
        if (queryParams[i] != "on") continue;
        firstVal ? console.log("starting to build add sql!") : addSql += ", ";
        addSql += "(" + instID;
        addSql += ", ";
        addSql += "\"" + date + "\", ";
        addSql += i + ", ";

        addSql += "1)";
        firstVal = false;
    }
    console.log("Add SQL: " + addSql);

    let rows = await query(addSql);

    res.write("<html dir='rtl' lang='heb'>");
    res.write("Data was added successfully...:-)");
    res.send();

    //insert sql:
    // insert into Participation (InstructorID, Date, ParticipantID, participated) VALUES (6, "27/8/2019", 10, 1), (6, "27/8/2019", 9, 1)
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/deactivateUsers', async (req, res) => {
    var usersDeact = 0;
    for (j = 0; j < 6000; j++) {
        if (req.query["ID-" + j] == "false") {
            var sql = "UPDATE members SET Active = 0 WHERE ID=" + j;
            rows = await query(sql);
            usersDeact++;
        }
    }
    res.write(usersDeact + " Users were updated!");
    res.send();


});
///////////////////////////////////////////////////////////////////////////////////////////////////////////
// Global variables:

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/getParticipation', async (req, res) => {
    var partSof = new Array();
    var psnum = 0;
    var members = new Array();
    var instructor = req.query.instID || req.query.InstID;
    console.log("getting participation for instructor:" + instructor);
    res.header("Content-Type", "text/html; charset=utf-8");

    var rows;
    var current = null;

    try {
        var userPartArr = new Array();
        rows = await query("select DISTINCT ParticipantID from participation where InstructorID = \"" + instructor + "\"");

        // the variable which will hold the json of the data:
        var retJson = "[";

        for (u = 0; u < rows.length; u++) {
            member = rows[u].ParticipantID;

            // get member name
            var member = await query("select FullName from members where ID = " + member);
            var memberName = member[0].FullName;

            // noe get all participation logged for that user and instructor
            var memberPart = await query("select * from participation where InstructorID = " + instructor + " and ParticipantID = " + rows[u].ParticipantID)

            if (u > 0) retJson += ", ";
            retJson += "{\"member\":\"" + memberName + "\", \"dates\":[";
            for (d = 0; d < memberPart.length; d++) {
                if (d > 0) retJson += ", ";
                retJson += "{\"date\":\"" + memberPart[d].Date + "\", \"participated\":" + memberPart[d].participated + "}";
            }
            retJson += "]}";
        }
        retJson += "]";
        o = 9;
        //      rows = await query("select * from participation where InstructorID = \""+instructor+"\"");
        //
        // get all userIDs for that instructor with logged participation
        // select DISTINCT ParticipantID from participation where InstructorID =  6
        //
        // all participation of user 1:
        // select * from participation where InstructorID =  6 and ParticipantID = 1
        //
        /*
                for (i=0; i < rows.length; i++)
                {
                    if (members.length > 0 && members[current.ParticipantID] != null) continue;
        
                    current = rows[i];
          
                    nameRows = await query("Select FullName from members where ID="+current.ParticipantID);
                    memberName = nameRows[0].FullName;            
                
                    partSof[memberName] = new Object();
                    partSof[memberName].dates = new Array(new Object());
                    partSof[memberName]["dates"][psnum].Date = current.Date;
                    partSof[memberName]["dates"][psnum].tookpart = current.participated;
        
        
                    // noe search all subsequent for more occurences of same name
                    for (j = i; j < rows.length; j++)
                    {
                        if (rows[j].ParticipantID == current.ParticipantID)
                        {
                            (typeof partSof[memberName] == "undefined")
                            {
                                partSof[memberName] = new Object(dates=[]);
                                partSof[memberName].dates = new Array();
                                partSof[memberName].dates[0] = new Object(date="", tookpart=false);
                                //partSof[memberName].dates[0] = new Object("date"="", "tookpart"=false);
                            
                                partSof[memberName].dates[psnum] = new Object(date="", tookpart=false);
                            partSof[memberName].dates[psnum].date = current.Date;
                            partSof[memberName].dates[psnum].tookpart = current.participated;
                            psnum++;
                        }
                    }
                }*/
        res.write(retJson);
        res.send();
    }
    catch (e) {
        console.log(e);
    }
});
////////////////////////////////////////////////////////////////////////////////////////////
console.log("random string: " + randomString(10));
app.listen(port, () => console.log(`Instructor app is now listening on port ${port}!`));




