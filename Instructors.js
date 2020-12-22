const REALLYSENDALLMAILS = false;
const AMOUNT_DAYS_OF_LAST = 14;
const querystring = require('querystring');
const express = require('express');
const sqlite3 = require('sqlite3');
//var xl = require('msexcel-builder');
const xl = require('excel4node');
const app = express();
const port = 1000
const FULL_DAY = 1000 * 60 * 60 * 24;

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
        //TODO: /getActivity if the user and the password are OK
        //For now only support Yaniv/king

        // check user\pw against db:
        let ret = await query("select * from users where username = \"" + username + "\"");

        if (ret.length > 0 && ret[0].password == password) 
        {
            // count amount of logins...
            countRequests(ret[0].id);

            // test members that are missing more than 2 weeks

            // login success!
            return doneCallback(null, { name: "\"" + username + "\"", id: ret[0].id });
        }
        else {
            // login failure!
            res.redirect(`http://localhost:1000/html\login.html?user=`+username);
            return;// doneCallback("Error! wrong user and/or password!", null);
        }

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

var lastDateCeck;
if (lastDateCeck === undefined) lastDateCeck = new Date();

var dateAvailabilityCheck = null;

//////////////////////////////////////////////////////////////////////////////////////
async function isCheckNow(dist)
{
    today = new Date();
    // check last time check for district:
    lastCheckSql = "select membersCheckDate from districts where id="+dist;
    var lastCheck = await query(lastCheckSql);
    var distDate = lastCheck[0].membersCheckDate;
    if (distDate == "") 
    {
        distDate = new Date("8/27/1970");
    }
    var diffFromLastCheck = Math.round((today - new Date(distDate)) / FULL_DAY);
    if (diffFromLastCheck < 7) return false;
    else return true;
}
/////////////////////////////////////////////////////////////////////////////////////
// run this check will run for ALL districts (once a week)!
async function checkMembersAvailability()
{
    // run this check for ALL districts!
    var distsSql = "select * from districts";
    var dists = await query(distsSql);

    for (var distIdx = 0; distIdx < dists.length; distIdx++)
    {
        dist = dists[distIdx].id;

        var check = await isCheckNow(dist);
        if (!Boolean(check)) continue;
        console.log(`checking availability of ALL members in district ${dist}`);

        // get instructors of this district:
        distInstsSql = "select ID from rakazim where District = "+dist;
        var distInsts = await query(distInstsSql);

        // search ALL members for each instructor of this district:
        for (instNum = 0; instNum < distInsts.length; instNum++)
        {
            inst = distInsts[instNum].ID;
            
             var oldParticipants = new Array();
            var sql = `select ParticipantID, max("Date") as maxDate from Participation where InstructorID=${inst} and participated="1" group by ParticipantID`;
            var ret = "";
            try
            {
                ret = await query(sql);
            } 
            catch(e) { console.log("error running query!\n"+e); };
           
            var resultArray = new Array();

            // check dates of all members to assert availability in last 2 weeks!
                            var today = Intl.DateTimeFormat('en-US').format(new Date());

            for (i = 0; i < ret.length; i++)
            {
                var returnResult = "[";
                var part = ret[i];
                var d = new Date(part.maxDate);

                var maxDateForInst = `select max("Date") as maxDate from Participation where InstructorID=${inst} and participated="1"`;

                mDateInst = await query(maxDateForInst);

                //var today = (new Date()).format('DD-MM-YYYY');

                // make sure that last date logged is within last 2 weeks! (AMOUNT_DAYS_OF_LAST)
                var diff = Math.round((new Date(mDateInst[0].maxDate) - new Date(d)) / (1000 * 60 * 60 * 24));
                if (diff > AMOUNT_DAYS_OF_LAST)
                {
                    // check if participant attended one of last 2 actions performed...
                    var attendedLast = false;
                    var sqlLast = `select Date from Participation where InstructorID=${inst} group by Date`;
                    var lastActs = await query(sqlLast);

                    if (lastActs[lastActs.length - 1] != mDateInst[0].maxDate || lastActs[lastActs.length - 2] != mDateInst[0].maxDate)
                    {
                        attendedLast = true;
                    }

                    if (!attendedLast)
                    {
                        if (returnResult != "[") returnResult += ", ";
                        returnResult += `{"ParticipantID": ${part.ParticipantID}}`;
                        resultArray.push(part.ParticipantID);
                    }
                    continue;
                }            
            }

            returnResult += "]";
            if (resultArray.length > 0)
            {
                alertMissingMembers(dist, resultArray, inst);
            }
            // update 'last check date' in DB...
        }
        // write when district was tested
        var addSql = `UPDATE districts SET membersCheckDate='${today}' WHERE id='${dist}'`;

        await query(addSql);

        // do not return those results as mails where sent instead! see alertMissingMembers
        //res.write(returnResult);
        //res.send();
    }
};
/////////////////////////////////////////////////////////////////////////////////////////////////////
async function alertMissingMembers(myDist, memberArr, instID)
{
    // start the missing check:

 
        // get district name:
        var dNameSql = "select * from districts where id="+myDist;
        var dName = await query(dNameSql);
        var myDistName = dName[0].Name;

        var distMgrSql = "select * from rakazim where Role='מנהל מחוז' AND District="+myDist;
        try {
            res = await query(distMgrSql);
        } catch(e) {};
        var distMgrName = res[0].Name;
        var distMgrMail = res[0].email;
    // get their names:
    var sql = "select FullName from members where ID in (";
    for (var i = 0; i < memberArr.length; i++)
    {
        if (i > 0) sql += ", ";
        sql += memberArr[i];
    }
    sql += ")";
    console.log("searching problematic member with this query:\n"+sql);
    var missingNames;
    try{
        missingNames = await query(sql);
    } catch(e) {};
    console.log("found "+missingNames.length+" result!");

    // find instructor's name:
    var instSql = "select * from rakazim where ID="+instID;
    var instRes = await query(instSql);
    var instName = instRes[0].Name;

    // now send alerting mail:
    var subject = `: שים לב: החניכים הבאים לא היו כבר שבועיים או יותר!`;
    var msgHtml = `היי,<br><b><font color='red'>מייל זה יישלח בעתיד ל ${distMgrName} מנהל מחוז ${myDistName}</font></b><br><br><font color='blue'>:לתשומת לבך הפעילים הבאים (של המדריך ${instName})  :לא הגיעו לפעילות בשבועיים האחרונים (בהן הייתה פעילות של הקבוצה)</font><br>`;

    for (p = 0; p < missingNames.length; p++)
    {
        msgHtml += (p+1)+". ";
        msgHtml += missingNames[p].FullName + "<br>";
    }
    msgHtml += "<br><b>את/ה מכיר/ה את זה? אולי כדאי להרים טלפון לראות שהכל בסדר...<br>בהצלחה</b>";

    //TODO: change mail address to district manager!
    sendInnerFormalMail(instID, msgHtml, subject, "");

    // write in DB the date of this check!
    var day = today.getDate();
    var month = today.getMonth();
    var year = today.getFullYear();

    var properDate = day+"/" + month + "/" + year;
    var addDate  = `update rakazim set missingMembersCheck='`+properDate+`' where ID=`+instID;

    var prevMail = await query(addDate);
}

//////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/checkMembersAvailability', async (req, res) => 
{
    await checkMembersAvailability();
});
//////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/forgotPassword', async (req, res) => 
{
    var user = req.query.user;
    var newpass = randomString(8);
    while (newpass.indexOf(" ") != -1)
    {
        newpass = randomString(8);
    }

    if (typeof(user) == "undefined") return;

    var updateSql = "update users set password='"+newpass+"' where username='"+user+"'";
    var mailbody = "<html lang='heb' dir='rtl'><head><meta charset=\"UTF-8\"></head><body>בחרת לאפס את סיסמתך והוקצתה לך הסיסמא: "+newpass+" <br>אנא השתדל לא לשכוח אותה. <b>שוב</B>...</body></html>";

    var currentUser = await query("select * from users where username='"+user+"'");
    if (currentUser.length == 0)
    {
        res.write("<html lang='he' dir='rtl'><head><meta charset=\"UTF-8\"></head><body>המשתמש '</h1>"+user+"'</h1> אינו מוכר למערכת! בקשתך לא תעובד...</body></html>");
        res.send();
        return;
    }
    var rakaz = await query("select * from rakazim where ID='"+currentUser[0].id+"'");

    var branchSql = `select * from Branches where Name='${rakaz[0].Branch}'`;
    var branchDetails = await query(branchSql);

    var changepwd = await query(updateSql);
    res.write(`<html lang='heb' dir='rtl'><head><meta charset=\"UTF-8\"></head><body><h1>סיסמת הרכז '${user}' הוחלפה לסיסמה חדשה ומייל נשלח אליך לסניף '${branchDetails[0].Name}'...</h1><br><h1>סגור חלון זה ונסה להיכנס מחדש...</h1><a href="${req.headers.referer}">Re-Login</a></body></html>`);
    
    sendFormalMail(user, mailbody, `לרכז '${user}' הוקצתה סיסמא חדשה (אפליקציית השתתפות) ודא/י שהודעה זו מגיע אליו/ה `, branchDetails[0].email);


});


async function countRequests(user)
{
    if (typeof(loginAmount) === "undefined") loginAmount = 0;
    if (typeof(loginDivider) === "undefined") loginDivider = 100;

    var u = await query("select * from users where id="+user);
    var username = u[0].username;

    loginAmount++;

    // send alert mail for amount of logins! (10, 20, 40, 80 and every 100...)
    if (loginAmount % loginDivider == 0) 
    {
        if (loginDivider < 100) loginDivider = loginDivider * 2;
        else loginDivider = 100;
        sendFormalMail("application", `There were <b>${loginAmount}</b> logins untill now...:), (last one: '${username}').`, `${loginAmount} logins`, "");
        
    }
}

app.get('/login', (req, res) => 
{
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
    var user = req.query.user;
    if (typeof(user) == "undefined")
    {
        res.sendFile(__dirname+"\\html\\Login.html");
    }
    else
    {
        res.sendFile(__dirname+"\\html\\Login.html?user="+user);
    }
});


app.post('/login', passport.authenticate('local', {
    successReturnToOrRedirect: '/good-login',
    failureRedirect: '/login'
}));

//this rule will verify that any call has prerequisite of login other than what's above...
// which is login get and post only
app.get("/favicon.ico", async(req, res) => {
    res.status(404);
});
app.use('/', ensureLogin.ensureLoggedIn('/login'), (req, res, next) => next());

app.use('/', (req, res, next) => {
    //log the current user:
    console.log("Logged in user" + JSON.stringify(req.user));
        
    next();
});
///////////////////////////////////////////////////////////////////////////////////////////////////////
async function sendInnerFormalMail(userName, msgHtml, subject, mailaddress)
{ 
    sendMails = true;
    yanivReporter = true;
    await sendFormalMail(userName, msgHtml, subject, mailaddress)
    yanivReporter = false;
    sendMails = true;
};
///////////////////////////////////////////////////////////////////////////////////////////////////////
async function sendFormalMail(userName, msgHtml, subject, mailaddress)
{ 
    if (!sendMails)
    {
         return;
    }
    if (yanivReporter)
    {
        mailaddress += ", yaniv@krembo.org.il";
    }
 
    var nodemailer = require('nodemailer');

    // Create the transporter with the required configuration for Outlook
    // change the user and pass !
    var transporter = nodemailer.createTransport({
        host: "smtp-mail.outlook.com", // hostname
        secureConnection: false, // TLS requires secureConnection to be false
        port: 587, // port for secure SMTP
        tls: {
        ciphers:'SSLv3'
        },
        auth: {
            user: 'krembo@krembo.org.il',
            pass: 'Poqe12346'
        }
    });

// setup e-mail data, even with unicode symbols
    var mailOptions = 
    {
        from: 'krembo@krembo.org.il', // sender address (who sends)
        to:mailaddress, // list of receivers (who receives)
        subject: subject, // Subject line
        html: `<html dir="rtl">` + msgHtml + `</html>` // html body
    };

    // send mail with defined transport object
    await transporter.sendMail(mailOptions, function(error, info)
    {
        if(error)
        {
            console.log(error);
            return -1;
        }
        console.log('Message sent: ' + info.response);
    });
    console.log("mail with meesage was sent to "+mailaddress+ "!");


}








    ///////////////////////////////////////////////////////////////////////////////////
    /*
    var outlookMail = require('nodejs-nodemailer-outlook');
    //outlookMail.base.setAnchorMailbox = "krembo@krembo.org.il";
    var res = outlookMail.sendEmail({
    auth: {
        user: "krembo@krembo.org.il",
        pass: "Wings2020"
    },
    host: 'https://outlook.office.com',
    port:443,
    secureConnection: true,
    tls:{
        ciphers:'SSLv3'
    },
    from: 'krembo@krembo.org.il',
    to: mailaddress,
    subject: subject,
    html: '<b>Msg FROM krembo@krembo.org.il!</b>\n\n'+ msgHtml,
    replyTo: 'krembo@krembo.org.il',
    attachments: [],
    onSuccess: (i) => console.log("secceeded sending mail: "+i),
    onError: (e) => console.log("error sending mail: "+e)
    
    });
    console.log("mail sent:\n"+res);
 
}
*/
///////////////////////////////////////////////////////////////////////////////////////////////////////
var sendToDistrictManagers = false;
var yanivReporter = true;
var sendMails = true;
//////////////////////////////////////////////////////////////////////////////////////
function sendMail(userName, msgHtml, subject, mailaddress)
{ 
    if (!sendMails)
    {
        // do not send mails!
        console.log("not sending mails:\n\n"+subject);

        if (yanivReporter)
        {
            mailaddress += "; yaniv@krembo.org.il";
        }
        return;
    }
     console.log("Sending mail!\n");

    var nodemailer = require('nodemailer');

    var transporter = nodemailer.createTransport(
    {
        service: 'gmail',
        auth: 
        {
/*            user: 'yaniv.haber@gmail.com',
            pass: 'Y2a7niv!8' 
            user: 'krembo@krembo.org.il',
            pass: 'Wings2020' */
            user: 'james@bond.com',
            pass: ',yPass'

        }
    });

    var mailOptions = 
    {
        from: '',
        to: mailaddress,
        subject: subject,
        html: msgHtml    
    };

    //mailOptions.html += "<br><br> שם משתמש וסיסמא ראשונית נוצרו לכם כך:<br>";
    //mailOptions.html += "<br><b>username</b>="+userName + ", <b>password</b>='"+password+`"'" <br><br> כדי להחליף סיסמא לחץ על לינק זה: http://yanivh-lapton:${sitePort}/changePassword?user=`+id;
    
    transporter.sendMail(mailOptions, function(error, info)
    {
        if (error) 
        {
            console.log(error);

        }
        else 
        {
            console.log("Sent to '"+userName+"'!");
            //console.log('Email sent: ' + info.response);
        }
    });
   
};
///////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/removeRakaz', async (req, res) => 
{
    var removeID = req.query.rakazim;
    var rakazName = req.query.rakazToDel;
    console.log("removing rakaz '"+rakazName+"'!");

    var removeSql = "DELETE FROM rakazim WHERE ID='"+removeID+"'";
    await query(removeSql);

    res.write(`<html lang="he" dir="rtl"><head><meta charset="utf-8" /></head>הרכז '${rakazName}' נמחק!`);
    res.send();
});

///////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/addRakaz', async (req, res) => 
{
    var i = 0;
    var fullName = req.query.name;
    var role = req.query.role;
    var phone = req.query.memPhone;
    var email = req.query.email;
    var branch = req.query.branch;
    

    // now add this new rakaz to DB...
    var addSql = `INSERT INTO rakazim (Name, Tel, Role, email, Branch) VALUES ('${fullName}', '${phone}', '${role}', '${email}', '${branch}')`;
    
    await query(addSql);

    res.write(`<html lang="he" dir="rtl"><head><meta charset="utf-8" /></head>`);
    res.write(`<h3>הרכז '${fullName}' נוסף לבסיס הנתונים!</h3></body></html>`);
    res.send();
});
////////////////////////////////////////////////////////////////////////////////////
app.get('/addMember', async (req, res) => 
{
    var i = 0;
    var fullName = req.query.name;
    var idnum = req.query.IDNum;
    var phone = req.query.phone;
    var email = req.query.email;
    var branch = req.query.branch;
    var layer = req.query.layer;

    // find proper district
    distSql = `select district from Branches where Name = "${branch}"`;
    let distFromDB = await query(distSql);

    var distName = `select Name from districts where id="`+distFromDB[0].district+`"`;
    distFromDB = await query(distName);

    // now add this new rakaz to DB...
    var addSql = `INSERT INTO members (FullName, District, Branch, IDnum, Active, layer, Phone, MailAddress) VALUES ("${fullName}", '${distFromDB[0].Name}', "${branch}", '${idnum}', 'true', '${layer}', '${phone}', '${email}')`;
    await query(addSql);

    res.write(`<html lang="he" dir="rtl"><head><meta charset="utf-8" /></head>`);
    res.write(`<h3>הפעיל "${fullName}" נוסף לבסיס הנתונים!</h3></body></html>`);

    var ret = await query("select * from users where id="+req.user.id);
    var username = ret[0].username;

    var msg = `<p dir="rtl">המשתמש '${username}' הכניס כרגע את הפעיל החדש: '${fullName}'.<br>פרטי הפעיל שנוסף הינם: <br>שם:"${fullName}", <br>מחוז:'${distFromDB[0].Name}', <br>סניף:"${branch}", <br>מס. ת.ז.:'${idnum}', <br>שכבת גיל:'${layer}', <br>טלפון:'${phone}', <br>אימייל:'${email}<br><br>עכשיו צריך להוסיף אותו ל-!SF</div>`;
        sendFormalMail(username, msg, `משתמש זה הוסיף כעת פעיל חדש!`, `david@krembo.org.il`);

    res.send();
});

function writeXl()
{
    var xl = require('excel4node');

var wb = new xl.Workbook();
var ws = wb.Worksheet('My Worksheet');

var myCell = ws.Cell(1, 1);
myCell.String('Test Value');

wb.write('myExcel.xlsx');
console.write("written myExcel.xlsx");
}
///////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/partCsv', async (req, res) => 
{
    var http = require('http');
    const fs = require('fs');
    
    var instructor = req.query.instID;
    var file = "participation.csv";
    
    var filePath = __dirname+"\\part"+instructor + "\\";
    try
    {
        res.writeHead(200, 
        {
              "Content-Type": "application/octet-stream",
              "Content-Disposition" : "attachment; filename=" + "participation.csv"
        });
            fs.createReadStream(filePath + file).pipe(res);
    }
    catch (e)
    {
        console.log("exception line 626: "+e);
    }
});
///////////////////////////////////////////////////////////////////////////////////////////////////////
function createParticipationExcel(rowsJson, instructor)
{ 
    if (rowsJson == "[]") return;
    var fs = require('fs');
    var rowData = JSON.parse(rowsJson);

    var csvContent = "FullName, Dates, \n, ";
    for (var datesIn = 0; datesIn < rowData[0].dates.length; datesIn++)
    {
        csvContent += rowData[0].dates[datesIn].date+ ",";
    }
    csvContent += "\n";
    // first convert rowData => csv file content
    for (var rNum = 0; rNum < rowData.length; rNum++)
    {
        //if (rNum > 0) csvContent += ", ";
        var row = rowData[rNum];
        csvContent += row.member + ", ";

       for (var di = 0; di < row.dates.length; di++)
       {
            if (di > 0) csvContent += ", ";
           var d = row.dates[di];
           if (d.participated)
                csvContent += "YES";
            else
                csvContent += "NO";            
       }
       csvContent += "\n";
    }
    // create dir if does not exist:
    var dir = __dirname+"\\part"+instructor;
    if (!fs.existsSync(dir))
    {
        fs.mkdirSync(dir);
    }
    var fName = dir+"\\participation.csv";
    
    fs.writeFile(fName, Buffer.from(csvContent,'utf8'), 'utf8',  function (err) 
    {
        if (err) throw err;
        console.log('Saved!');
    });

    return fName;

    
    // write csv file:
    /*
}
    const createCsvWriter = require('csv-writer').createObjectCsvWriter;
    const csvWriter = createCsvWriter(
    {
        path: dir+"\\participation.csv",
        header: [
            {id: 'fullName', title: 'FullName'},
            {id: 'Dates', title: 'Dates'},
            {id: 'Participated', title: 'Participated'},
        ]
    });
    // now write the csv content to file
    //csvWriter.writeRecords(csvContent);
    csvWriter.writeRecords(csvContent)
    .then(() => {
        console.log('...Done');
        
    });
    
    
    // Create a new instance of a Workbook class
  fs.writeFile(CSV_NAME, 'utf8', function(err, data) 
  {
    if (err == null)
    {
        // error is 'file does not exist'? create it!
    }
    if (!data)
    {
        // file does not exist yet. create it
        var fileData = "";
        for (var f = 0; f < rowData.length; f++)
        {
            fileData += rowData[f].FullName + "\n";
        }

        fs.writeFile(CSV_NAME, fileData,'utf8', function (err) 
        {
            if (err) return console.log(err);
        });
    }
    console.log('OK: ' + "wrote "+CSV_NAME);
  });
  */
}

///////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/myTeam', async (req, res) => 
{
    var layerFilter = null;
    layerFilter = req.query["filterLayer"];
    if (layerFilter == null) layerFilter = "כולם";
    var totalHtml = "";
        name = await query("select Name, Branch from rakazim where ID="+req.user.id);
    
    totalHtml += `<html lang="he" dir="rtl"><head><meta charset="utf-8" /></head>`;

    totalHtml += `<section style="direction: rtl;  border:50px; border-width: 5px; border-style: solid; border-color: navy; background-color: "#4a90e2"><img src="http://`+req.get("host")+`\/html\/לוגו_כנפיים_של_קרמבו.jpg" alt='כנפים של קרמבו' style="height: 150px; width: 150px;"></img>`;
    totalHtml += `<span style="position: absolute; top: 30; right: 150;">כנפים של קרמבו - אפליקציית 'השתתפות' <br>${name[0].Name} מסניף '${name[0].Branch}'</span></h1><br><div style="position: fixed; right: 150px;"></span></div></section>`;
    
    totalHtml += '<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>\n';
    totalHtml +=  `<script src="./html/protegeActivity.js"></script>\n`;
        totalHtml += "<script language=\"javascript\">\n";

    layers = await query(`select distinct layer from members  where Branch = '${name[0].Branch}' ;`);
    var layNum = 1;
    var layersHtml = `<form id='myTeamForm' action='./myTeam' method='get'><select name='filterLayer' id='layers' onChange='selectLayer(this.options[this.selectedIndex].value)'>`;
    
    layersHtml += `<option id='layer0' value='כולם'>כולם</option>`;
    for (var i = 0; i < layers.length; i++)
    {
        var lay = layers[i];
        if (layers[i].layer == "") lay.layer = "לא הוגדר";
        if (lay.layer == null && i == 0) break;        
    
        var filterBy = false;
        if (lay.layer == layerFilter || (layerFilter == "" && lay.layer == "לא הוגדר")) filterBy = true;
        if (lay.layer == null)  { break; };
        var currLayer = lay.layer;
        if (currLayer == "לא הוגדר") currLayer = "";
        layersHtml += `<option id='layer${layNum}' value='${currLayer}'`+(filterBy? " selected>": ">")+`${lay.layer}</option>`;
        layNum++;
    }
    layersHtml += "</select></form>";
    totalHtml += "var layersHtml = \""+layersHtml + "\";";
    
    totalHtml += `\ndocument.writeln("<br>סנן חניכים לפי שכבת גיל: "+layersHtml);`;
    totalHtml += `\n var user = JSON.parse('{ "yaniv":"haber", "name": "${name[0].Name}", "id": "${req.user.id}", "branch": "${name[0].Branch}"`;
    
    admin = await query("select * from users where id="+req.user.id); 
    totalHtml += `, "admin":"${admin[0].admin}"}');\n`;

    // now get the instructor users
    console.log("getting members for logged-on instructor:" + req.user.id);
    
    let rows = await query("select Branch from rakazim where ID = " + req.user.id);
    var dist = rows[0].Branch;


    var q = "select * from members where Branch='" + dist + "'";
    if (layerFilter !== undefined && layerFilter != 'כולם') q += " AND layer='"+layerFilter+"'";
    q += " order by FullName";
    //let rows = await query("Select * from members where Branch='"+req.query.Branch+"'");
    var retArray = "[";
    try 
    {
        let rows2 = await query(q);
        console.log("found " + rows2.length + " rows!");

        for (i = 0; i < rows2.length; i++) 
        {
               if (i > 0) retArray += ", ";
                retArray += `{ "name": "${rows2[i].FullName}", "memberID": "${rows2[i].ID}", "active": "${rows2[i].Active}"}`;
        }
        retArray += "]";
    }
    catch (e)
    {
        console.log("exception: "+e);
    }

    totalHtml += "var json2 = `"+retArray+"`;\n";
    
    totalHtml += "\n var memHtml = drawMembers(json2, "+req.user.id+"); \n ";
    totalHtml += "setTimeout(function () {document.getElementById('teamMembers').innerHTML = memHtml;}, 500);";
    totalHtml += "</script>";
    totalHtml += `\n <span id="teamMembers"></span>`;
    totalHtml += "\n</body></html>";
    
    res.write(totalHtml);
    res.send();
});

///////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/good-login', async (req, res) => {
    var userid = req.user.id;
    var userObj = await query("select * from users where id="+req.user.id);
    if (userObj[0].admin == "1")
    {
        // admin user
        res.redirect("/html/InstructorLinksAdmin.html");
    }
    else
    {
        // NON admin user
        res.redirect("/html/instructorsLinks.html");
    }
    
    //res.write("<html dir='rtl' lang='he'><meta charset=\"utf-8\"><p>הצלחת להיכנס למערכת! :-)</p><br><a href=\"/html/instructorslinks.html?user="+userid+"\">לינקים למדריכים...</a></html>");
    res.send();
});
///////////////////////////////////////////////////////////////////////////////////////////////////////
//
// return a JSON object that describes ther loggedin user: "{name:john, id:89, admin: 0}"
//
app.get("/userName", async(req, res) => 
{
    name = await query("select Name, Branch, Role, District from rakazim where ID="+req.user.id);

    var rightBranch = ((name[0].Branch !== "undefined") ? name[0].Branch: "unknown");
    //if (name[0].Role == "מנהל מחוז")
    {
        // get name of district
        distNameSql = `select * from Branches where Name="`+name[0].Branch+`"`;
        dName = await query(distNameSql);
    }
    distName = 
    res.write(`{ "name": "${name[0].Name}", "id": "${req.user.id}", "role":"${name[0].Role}", "District":"${dName[0].district}", "branch":"${rightBranch}"`);

    //test = "{ \"name\": \""+name[0].Name+"\", \"id\": "+req.user.id + ", \"role\":\""+name[0].role + "\", \"branch\":"+((name[0].Branch!== 'undefined') ? "\""+name[0].Branch+"\"": 'unknown');

    admin = await query("select * from users where id="+req.user.id); 
    res.write(", \"admin\":"+admin[0].admin+"}");
    res.send();
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////
// get a description of a user with a certain id {}name: , id: , branch: ,admin: ?}
app.get("/userDetails", async(req, res) => 
{
    var id = req.query.ID;
    if (id == "")
    {
        res.write("No user ID!");
        res.send();
        return;
    }
    var retJson = "";
    name = await query("select Name, Branch from rakazim where ID="+id);
    if (name.length > 0)
    {
        retJson = "{ \"name\": \""+name[0].Name+"\", \"id\": "+id + ", \"branch\":"+((name[0].Branch!== 'undefined') ? "\""+name[0].Branch+"\"": 'unknown');

        logInUser = await query("select * from users where id="+id); 
        retJson += ", \"admin\":"+((logInUser.length > 0)? logInUser[0].admin: "0") + `, "loggedUser":"${req.user.id}"}`;
        res.write(retJson);
        res.send();

        console.log("returned:\n"+retJson);
    }
    

    
});


///////////////////////////////////////////////////////////////////////////////////////////////////////
app.get("/isAdmin", async(req, res) => {

     var userid = req.user.id;
     var admin = await query("select admin from users where id="+userid);
     
     if (admin[0].admin)
    {
        res.write("true");
    }
    else
    {
        res.write("false");
    }
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
async function query(queryStr, ...params) 
{
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

    var ret = await query("select * from Participation where InstructorID="+instID+" and Date='"+date+"'");
    var participated = ret.length;

    // now find TOTAL amount of users, then find 'not participated'...
    
    var total = await query("select DISTINCT ParticipantID from participation where InstructorID = "+instID);
    var notPart = total.length - participated;
    var instMems = await getInstMembers(instID);
    var retMsg = "{\"participated\": "+participated+", \"notParticipated\": "+(instMems.length - participated)+"}";
        
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

    let ret = await query("select Name, Branch from rakazim where ID = " + instructor);
    res.header("Content-Type", "text/html; charset=utf-8");
    res.write("{\"Name\":\"" + ret[0].Name + "\", \"branch\":\"" + ret[0].Branch + "\"");

    // add 'admin' flag
    let AD = await query("select * from users where id=" + instructor);
    res.write(", \"admin\":\""+AD[0].admin+"\"}");
    console.log("get name of instructor " + instructor + ", returned: " + ret[0].Name);
    res.send();

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
// get dates of sctivities which are logged for current instructor
app.get('/getInstDates', async (req, res) => {
    var instID = req.query.instID;
    res.header("Content-Type", "text/html; charset=utf-8");

    var sql = "select distinct Date from Participation where InstructorID = " + instID;

    let rows = await query(sql);

    // also add date totals summary:

    var op = "[";
    for (var row = 0; row < rows.length; row++) 
    {
        if (row > 0) op += ", ";
        if (rows[row].Date == "") continue;
        var msg = await getParticipationSummary(instID, rows[row].Date);
        var datesSummary = JSON.parse(msg);
         op += "\{\"date\":\"" + rows[row].Date + "\", \"yes\":\""+datesSummary.participated+"\", \"no\":\""+datesSummary.notParticipated+"\"}";
    }
    op += "]";
    res.write(op);
    res.send();
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/branches', async (req, res) => 
{
    res.header("Content-Type", "text/html; charset=utf-8");

    let rows = await query("select Name from Branches");

    var op = "[";
    for (let i = 0; i < rows.length - 1; i++) {
        op += "{\"Name\":\"" + rows[i].Name + "\"}";
        if (i != rows.length - 2) op += ", ";
    }
    op += "]";
    res.write(op);
    res.send();
});
///////////////////////////////////////////////////////////////////////////////////////////
app.get('/getDistrict', async(req, res) =>
{
    var dist = req.query["dist"];
    var sql = "select * from districts where id = "+dist;

    var ret = await query(sql);
    
    res.write(`{"Name":"${ret[0].Name}", "id":"${dist}" }`);

    res.send();
});
///////////////////////////////////////////////////////////////////////////////////////////
app.get('/distBranches', async(req, res) =>
{
        let dist =  req.query["dist"];
        if (dist == undefined) 
        {
            res.write("ERROR: You should supply psaram 'dist' for the requested district!");
            res.send();
        }
        else
        {
            var getDistrict = "select * from districts where id = "+dist;

            var ret = await query(getDistrict);
    
            var json = `{"Name":"${ret[0].Name}", "id":"${dist}", `;


            json += `"branches":[`;
            let sql = "select Name from Branches where district = " + dist;
            var branches = await query(sql);
       
            for (let i = 0; i < branches.length; i++)
            {
                // find amount of members for each branch
                let branchAmountSql = "select * from members where Branch = \""+branches[i].Name+"\"";
                memsAmount = await query(branchAmountSql);

                json += `{ "branch": "${branches[i].Name}", "members": "${memsAmount.length}" }`;
                if (i != branches.length - 1) json += ", ";
            }
            json += "]}";
            res.write(json);
            res.send();
        }
});
/////////////////////////////////////////////////////////////////////////////////////////////////
    app.get('/distManagers', async (req, res) => 
    {
        res.header("Content-Type", "text/html; charset=utf-8");

        let rows = await query(`select ID, Name, District from rakazim where Role == "מנהל מחוז"`);

        var op = "[";
        for (let i = 0; i < rows.length; i++) 
        {
            op += "{\"id\":\"" + rows[i].ID + "\"";
            op += ", ";
            op += `"Name":"${rows[i].Name}"`;
            op += ", ";

            dist = await query("select Name from districts where id="+rows[i].District);
            op += "\"district\":\"" + dist[0].Name + "\"";


            // get amount of branches
            var totalAmount = 0;
            branchesSql = "select * from Branches where district="+rows[i].District;
            branches = await query(branchesSql);
            for (var j = 0; j < branches.length; j++)
            {
                // get all members of branch
                memsSql = `select * from members where Branch="`+branches[j].Name+`"`;
                var mems = await query(memsSql);
                totalAmount += mems.length;
            }
            op += `, "branches":"`+branches.length+`", "members":"`+totalAmount+`"`;
            op += "}";
                        if (i != rows.length - 1) op += ", ";
        }
        op += "]";
        res.write(op);
        res.send();
    });
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/rakazim', async (req, res) => {

        // first check current user:
        currUser = await query("select * from rakazim where ID = "+req.user.id);
        var rakazimQuery = "";
        if (currUser[0].Role == "מנהל מחוז")
        {
            var managerDist = currUser[0].District;
            rakazimQuery = "select ID, Name, Branch from rakazim where Branch in ";
            rakazimQuery += "(";
            rakazimQuery += "select Name from branches where district = "+managerDist;
            rakazimQuery += ")";
            rakazimQuery += " order by rakazim.Name";
            //`select * from rakazim where District = `+req.user.District;
        }
        else
            rakazimQuery = `select ID, Name, Branch from rakazim where Role <> "מנהל מחוז"`;
            rakazimQuery += ` order by rakazim.Name`;

    res.header("Content-Type", "text/html; charset=utf-8");

    // query: `select ID, Name, Branch from rakazim where Role <> "מנהל מחוז"`
    let rows = await query(rakazimQuery);

    var op = "[";
    op += `{"id":"", "Name":"Please select", "snif":""}, `;
    for (let i = 0; i < rows.length; i++) 
    {
        if (rows[i].Name == currUser[0].Name) continue;
        if (op.substring(op.length - 1) == "}") op += ", ";
                op += "{\"id\":\"" + rows[i].ID + "\"";
        op += ", ";
        op += `"snif":"${rows[i].Branch}"`;
        op += ", ";
        op += "\"Name\":\"" + rows[i].Name + "\"}";
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
        let rows = await query("select Branch from rakazim");
        console.log("got branches!");

        //res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
        var retStr = "[";
        for (let i = 0; i < rows.length - 1; i++) {
            var currDist = rows[i].Branch;
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
        console.log("failed to retrieve list of branches: " + e);
    }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/yaniv', async (req, res) => {
    res.write("klum4");
    sendFormalMail("yaniv", "This is N email! :-0", "testing email", "");
    res.send();
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
// get list of in-active users OR re-activate list of users sent...
app.get('/getInactiveUsers', async (req, res) => {
    
    console.log("getting non-active members OR re-activating members.");

    if (typeof req.query["activateUsers"] !== 'undefined') 
    {
        // activation  change!
        var activateUsers = req.query.activateUsers;
        console.log("Re activating users " + activateUsers);
        var reActivateUsers = activateUsers.split(",");

        try {
            var activateSql = "update members set active = 'TRUE' where ID in (";
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
        let rows = await query(`select * from members where active <> "TRUE"`);

        var retArray = "[";
        try {
            console.log("found " + rows.length + " non-active users!");

            for (i = 0; i < rows.length; i++) {
                if (i > 0) retArray += ", ";
                retArray += "{";
                retArray += "\"name\": \"" + rows[i].FullName + "\", ";
                retArray += "\"branch\": \"" + rows[i].Branch + "\", ";
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
///////////////////////////////////////////////////////////////////////////////////////////////////
async function getInstMembers(instID)
{
   //console.log("getting members for instructor:" + req.query.instID);
    let rows = await query("select Branch from rakazim where ID = " + instID);
    if (rows.length == 0)
    {
        return["none!"];
    }
    else
    {
        var dist = rows[0].Branch;

        var q = `select ID, FullName, Active from members where Branch=`;
        q += `"`+dist+`"`;
       var retArray = new Array();
        try 
        {
            let rows2 = await query(q);
            console.log("found " + rows2.length + " rows!");

            for (j = 0; j < rows2.length; j++)
            {
                retArray[j] = new Object();
                retArray[j].memID = rows2[j].ID;
            }

        }
        catch (e) {
            console.log(e);
        }
    }
    return retArray;
       
}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/membersForInstructor', async (req, res) => {
    console.log("getting members for instructor:" + req.query.instID);
    if (req.index !== undefined) var lay = req.index.layer;
    res.header("Content-Type", "text/html; charset=utf-8");
    let rows = await query("select Branch from rakazim where ID = " + req.query.instID);
    if (rows.length == 0)
    {
        res.write("none!");
        res.send();
    }
    else
    {
        var dist = rows[0].Branch;

        var q = `select ID, FullName, Active from members where`;
        q += " Branch=";
        q += `"`+dist+`"`;
        q += ` order by FullName`;

        var retArray = "[";
        try 
        {
            let rows2 = await query(q);
            console.log("found " + rows2.length + " rows!");

            for (i = 0; i < rows2.length; i++) {
                if (i > 0) retArray += ", ";
                retArray += "{";
                retArray += "\"name\":\"" + rows2[i].FullName + "\", ";
                retArray += "\"memberID\":\"" + rows2[i].ID + "\", ";
                retArray += "\"Active\":\"" + rows2[i].Active + "\"";
                retArray += "}";
            }
            retArray += "]";


        }
        catch (e) {
            console.log(e);
        }


        res.write(retArray);
        res.send();
    }
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/sendMessage', async (req, res) => {
    var msg = req.query["sendMsg"];
    instID = req.query.instID;

    var name = await query("select Name, Branch, District from rakazim where ID="+instID);
    var myName = name[0].Name;
    var myDist = name[0].District;

    // find districtManager:
    var distMgrSql = "select * from rakazim where Role=\"מנהל מחוז\" and District="+myDist;
    var mgrName = await query(distMgrSql);
    if (mgrName.length == 0)
    {
        distMgrName = distMgrMail = "";
    }
    else
    {
        var distMgrName = mgrName[0].Name;
        var distMgrMail = mgrName[0].email;
    }

    // send to dist manager only when system is set to REAL mode...
    if (!REALLYSENDALLMAILS) distMgrMail = "";
    
    reporter = true;
    try{
        sendFormalMail(myName, `<html lang='he' dir='rtl'>המשתמש '${myName}' שלח מסר מאפליקציית 'השתתפות' בלשון זו:<br><b>"${msg}"</b></html>`, `Message from ${myName}`, distMgrMail);
    }
    catch (e)
    {
        console.log("failed sending mail because:\n"+e);
    }

    res.write("<html lang='heb' dir='rtl'><head><meta http-equiv='Content-Type' content='text/html; charset=UTF-8'></head><h1>הודעתך נשלחה!</h1><br>המשך יום נעים...</html>");
    res.send();
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/downloadFile', async (req, res) => { 

const http = require('http');
const fs = require('fs');

// get participation data from getParticipation and write it to excel! 


const file = fs.createWriteStream("myExcel.xlsx");


var readStream = fs.createReadStream("myExcel.xlsx");



readStream.on('open', function () 
    {
            // This just pipes the read stream to the response object (which goes to the client)
            //var data = fs.readFileSync("myExcel.xlsx", , 'utf8');
        
        
        //res.write(
            //readStream.pipe(res);
            //res.pipe(readStream.readStream());
            //readStream.readStream(); );
        //});
        
        readStream.on('error', function(err) {
            console.log("got error: "+err);
        });
        
        res.pipe(readStream);
        res.send();

    });
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/addParticipation', async (req, res) => { 
    var params = querystring.parse();
    var queryParams = new Array();

    var instID = req.query.instID;
    var date = req.query.actDate;
    var paramCount = 0;
    for (i = 0; i < 8000; i++) 
    {
        if (req.query["ID-" + i] != undefined) 
        {
            queryParams[i] = req.query["ID-" + i];
            paramCount++;
        }

    }
            var actName = req.query["ActivityName"];
        var actType = req.query["ActivityType"];
        var actSubtype = req.query["subtype"];
        var actSql;

        var noDouble = await query(`select * from Activity where Date='${date}' and InstructorID = '${instID}'`);
        if (noDouble.length > 0)
        {
            // instead of updating the activity, delete it completely and add a new one...
            actSql = `UPDATE Activity SET Name="`+escapeSingleApos(actName)+`", Type="`+escapeSingleApos(actType)+`", subtype="`+escapeSingleApos(actSubtype)+`"`;
            actSql += ` , InstructorID="${instID}", Date="${date}" WHERE ActivityID="${noDouble[0].ActivityID}"`;
    
            // run update query:
            await query(actSql);

            res.write(`<html lang='heb' dir='rtl'><head><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>`);
            res.write("<h1>הנתונים היבשים של הפעולה עודכנו...(ללא עדכון משתתפים)!</h1></html>");
            res.send();
            return;
        }
        // first create such an activity...
        actSql = "INSERT into Activity (Name, Type, subtype, InstructorID, Date) VALUES ("
        actSql += `'`+escapeSingleApos(`${actName}`)+`', '`+escapeSingleApos(`${actType}`)+`', '`+escapeSingleApos(`${actSubtype}`)+`', "${instID}", "${date}")`;
        //actSql += `'`+escapeSingleApos(`'`+${actName}+`')+', '`+escapeSingleApos(`${actType})+`', '`+`escapeSingleApos(`${actSubtype}`)+`', "${instID}", "${date}")`;
        
        let rows0 = await query(actSql);

        // now find actID...
        let rows2 = await query("select max(ActivityID) as maximum from Activity");
        let ActID = rows2[0].maximum;

    console.log("found " + paramCount + " participating members!");

    // create the full DB insert command:
    addSql = "insert into Participation (InstructorID, Date, ParticipantID, participated, Activity) VALUES ";
    var firstVal = true;

    if (queryParams.length == 0)
    {
        res.write(`<html lang='heb' dir='rtl'><head><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>`);
        res.write("<h1>לא ניתן לייצר פעולה עם <b>אפס</b> משתתפים!</h1></html>");
        res.send();
        return;

    }


    var mems = await getInstMembers(instID);
    // add all members that attended this activity:
    for (i = 0; i < mems.length; i++) 
    {
        firstVal ? console.log("starting to build add sql!") : addSql += ", ";
        addSql += "(" + instID;
        addSql += ", ";
        addSql += "\"" + date + "\", ";
        addSql += mems[i].memID + ", ";
        
        if (queryParams[mems[i].memID] == "on") 
            addSql += "1, ";
        else
            addSql += "0, ";
        addSql += ActID + ")";
        firstVal = false;
    }
    console.log("Add SQL: " + addSql);

    let rows = await query(addSql);

    res.write(`<html lang='heb' dir='rtl'><head><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>`);
    res.write("<h1>הפעולה נקלטה בהצלחה!...:-)</h1></html>");

    var name = await query("select Name, Branch from rakazim where ID="+req.query.instID);

    // TODO: find the branch email to send it to!
    let distMail = await query(`select email from Branches where Name="${name[0].Branch}"`);
    // send mail to yaniv! to be changed with line after!
    sendFormalMail(name[0].Name, name[0].Name+` הוסיף בהצלחה את הפעולה '${actName}'`,  `הפעולה '${actName}' נוספה בהצלחה`, "${distMail[0].email}");
    // send mail to district
    //sendMail("user ID:"+name[0].Name, name[0].Name+` הוסיף בהצלחה את הפעולה '${actName}'`,  `הפעולה '${actName}' נוספה בהצלחה`, distMail[0].email);
    res.send();

    //insert sql:
    // insert into Participation (InstructorID, Date, ParticipantID, participated) VALUES (6, "27/8/2019", 10, 1), (6, "27/8/2019", 9, 1)
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/welcome', async (req, res) => 
{
    var user = req.user;

    var userid = user.id;

    var userObj = await query("select * from users where id="+userid);
    if (userObj[0].admin == "1")
    {
        // admin user
        res.redirect("/html/InstructorLinksAdmin.html");
    }
    else
    {
        // admin user
        res.redirect("/html/instructorsLinks.html");
    }

});
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/deactivateUsers', async (req, res) => 
{
    var userReact = 0;
    var usersDeact = 0;
    for (j = 0; j < 7000; j++) {
        if (req.query["ID-" + j] == "false") 
        {   
            var sql = "UPDATE members SET Active = \"FALSE\" WHERE ID=" + j;
            rows = await query(sql);
            usersDeact++;
        }
    }
    
    for (j = 0; j < 7000; j++) 
    {
        if (req.query["ID-" + j] == "true") 
        {   
                var sql = "UPDATE members SET Active = \"TRUE\" WHERE ID=" + j;
                rows = await query(sql);
                userReact++;
        }
    }

    res.header("Content-Type", "application/json; charset=utf-8");
    if (usersDeact == 1) verb = " was";
    else verb = "s were";
    res.write(usersDeact + " User"+verb+" updated!");

    // find out user name
    var name = await query("select Name, Branch from rakazim where ID="+req.user.id);

    sendFormalMail("user ID:"+req.query.instID, "שים לב:<br><b>That user just <font color='red'>deactivated</font> "+usersDeact+" users! and <font color='green'>REactivated</font> "+userReact+" users.</b>", "De\Re-activation summary. (done by user:'"+ name[0].Name+"')", "david@krembo.org.il");

    // מצא את המחוז של הרכז:
    dist = await query(`select district from Branches where Name='${name[0].Branch}'`);

    distMan = await query(`select * from rakazim where Role='מנהל מחוז' AND District=${dist[0].district}`);

    // שלח מייל גם למנהל המחוז:
    if ( sendToDistrictManagers )
    {
        sendFormalMail("user ID:"+req.query.instID, "שים לב:<br><b>That user just <font color='red'>deactivated</font> "+usersDeact+" users! and <font color='green'>REactivated</font> "+userReact+" users.</b>", "De\Re-activation summary. (done by user:'"+ name[0].Name+"')", distMan[0].email+", david@krembo.org.il");
    }


    res.send();


});
///////////////////////////////////////////////////////////////////////////////////////////////////////////
// Global variables:

///////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/getActivity', async (req, res) => 
{
    var instructor = req.query.instID;
    var date = req.query.date;
    var point = req.query.point;

    var sql = "select * from Activity where InstructorID = '" + instructor+"' AND Date = '"+date+"'";

    rows = await query(sql);

    if (rows.length == 0)
    {
        //retJson = `{"Name": ${rows[0].Name}, "type":${rows[0].Type}, "subtype":${rows[0].subtype}, "ActID":"${rows[0].ActivityID}", "point":"${point}"}`;
        retJson = `{"Name":"<font color='red'><b>לא תועד!</b></font>", "type":"<font color='red'><b>לא תועד!</b></font>", "subtype":"<font color='red'><b>לא תועד!</b></font>", "point":"${point}"}, "ActID":"${rows[0].ActivityID}`;
    }
    else
    {
        var name = escapeApostrophes(rows[0].Name);
        if (name == "") 
        {
            name = `<font color='red'><b>לא תועד!</b></font>`;
        }
        actType = rows[0].Type;
        if (actType == "") actType = "אין תיעוד!";
        retJson = `{"Name":"${name}", "type":"${actType}", "subtype":"`+escapeApostrophes(rows[0].subtype)+`", "actID":"${rows[0].ActivityID}", "point":"${point}"`;
        if (point ==="undefined") retJson += `", point":"${point}"}`;
        else retJson += `}`;
    }
    console.log("JSON: "+retJson);

    res.write(retJson);
    res.send(); 
});
////////////////////////////
function escapeSingleApos(msg)
{
        var translated = msg.replace("'", "''");
        translated = translated.replace(`"`, `\\"`);
    return translated;

}
////////////////////////////////
function escapeApostrophes(msg)
{
    var translated = msg.replace(`"`, `\\"`);
    return translated;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////
function randomString(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/deleteActivity', async (req, res) => {
    var actID = req.query.actid;
    var instID = req.query.instid;

    // get axt details:
    actDetails = "select * from Activity where ActivityID="+actID;
    res = await query(actDetails);
var actName = res[0].Name;

    // FIRSTdelete all participation of this activity (due to FK...)
    removePartSql = "DELETE FROM Participation where Activity="+actID;
    await query(removePartSql);

removeActSql = "DELETE FROM Activity where ActivityID="+actID;
    await query(removeActSql);
        
    var name = await query("select Name, Branch from rakazim where ID="+instID);
    var name = name[0].Name;

    sendFormalMail(name, "המשתמש '"+name+"' מחק פעולה '"+actName+"'!", "מחיקת פעולה!", "david@krembo.org.il");

        res.write(`<html lang='he' dir='rtl'><head dir='rtl'><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>`);
    res.write("<h1>הפעולה נמחקה בהצלחה!</h1></body></html>");
    res.send();
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/getParticipation', async (req, res) => {
    var partSof = new Array();
    var psnum = 0;
    var members = new Array();
    var instructor = req.query.instID;
    console.log("getting participation for instructor:" + instructor);
    res.header("Content-Type", "text/html; charset=utf-8");

    var rows;
    var current = null;

    try 
    {
        var sortByNameQ = "select DISTINCT participation.ParticipantID, members.FullName from participation INNER JOIN members ON Participation.ParticipantID = members.ID where Participation.InstructorID = "+instructor+" order by members.FullName";
        //rows = await query("select DISTINCT ParticipantID from participation where InstructorID = \"" + instructor + "\"");
        rows = await query(sortByNameQ);
   
        
        
        // the variable which will hold the json of the data:
        var retJson = "[";

        //participSheet.set(1, 1, 'חניך');

        for (u = 0; u < rows.length; u++) 
        {
            member = rows[u].ParticipantID;
            if (member == 23)
            {
                var breakhere=true;
            }

            // get member name
            var memberRes = await query("select FullName from members where ID = " + rows[u].ParticipantID);
            if (memberRes.length > 0)
            {
                if (u > 0 && retJson != "[") retJson += ", ";
                var memberName = memberRes[0].FullName;

                // now get all participation logged for that user and instructor
                var memberPart = await query("select * from participation where InstructorID = " + instructor + " and ParticipantID = " + rows[u].ParticipantID)

                retJson += "{\"member\":\"" + memberName + "\", \"dates\":[";
                //participSheet.set(u+2, 1, memberName);
                for (d = 0; d < memberPart.length; d++) {
                    if (d > 0) retJson += ", ";
                    if (memberPart[0].ParticipantID == 19)
                    {
                        var stophere=true;
                    }
                    retJson += "{\"date\":\"" + memberPart[d].Date + "\", \"participated\":" + memberPart[d].participated + "}";
                }
                retJson += "]}";
            }
            else
            {
                console.log("user was removed...");
            }
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
                var file = createParticipationExcel(retJson, instructor);
                res.write(retJson);
                res.send();
    }
    catch (e) {
        console.log(e);
    }
});

function csvNextLine(fileName)
{
    var stream = fs.createWriteStream(fileName);
    tream.once('open', function(fd) 
    {
    stream.write("\n");
        stream.end();
    });
}
var CSV_NAME = "Participation.csv";
function saveInCSV(inst, msg)
{
    var fileName = inst+CSV_NAME;
    var fs = require('fs');
    var stream = fs.createWriteStream(fileName);
    stream.once('open', function(fd) 
    {
    stream.write(","+msg);
        stream.end();
    });
    return fileName;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/replacePassword', async (req, res) => 
{
    var oldPass = req.query.firstPassword;
    var newPass = req.query.newPassword;
    var user = req.query.user;

    if (db == null) db = new sqlite3.Database('C:\\develop\\Node.js\\Participation\\Participation.db', (err) => {
        if (err) 
        {
            console.log("error connecting to db...:"+err);
        }
    });

    var u = await query("select * from users where id="+user);

    if (u[0].password == oldPass)
    {
        // old password is correct :) change to new...
        var newUser = await query("update users set password = '"+newPass+"' where id="+user);
        res.write("<html lang='he' dir='rtl'><head><meta charset=\"UTF-8\"></head><body><h1>Your password was changed!</h1><br><h1>סגור חלון זה ועבור חזרה לדף הלינקים...</h1><input type=\"button\" value=\"Close\" onclick=\"window.close()\"></body></html>");




    }
    else
    {
        res.write(`<html><body><h1>Old password is NOT your pasword...sorry... <br><font color="red">Your password will NOT be changed!</font></h1></body></html>`);    }
    res.send();
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/changePassword', async (req, res) => 
{
    var user = req.user.id;
    if (db == null) db = new sqlite3.Database('C:\\develop\\Node.js\\Participation\\Participation.db', (err) => {
        if (err) 
        {
            console.log("error connecting to db...:"+err);
        }
    });

    var users = await query("select Name, Branch from rakazim where ID="+user);

    res.write(`<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta content='width=device-width, initial-scale=1' name='viewport'/></head><body>:`);
    res.write(`<section style="direction: rtl; height:150px; border:50px; border-width: 5px; border-style: solid; border-color: "#4a90e2" background: "#4a90e2"><h1><img src="./html/style/סמל_קרמבו_חדש_עברית.jpg" alt="כנפים של קרמבו" style="width:120px; height:120px; position: fixed; top: 32px; right: 15;"/>`);
    res.write(`<span style="position: absolute; top: 30; right: 150;">כנפים של קרמבו - אפליקציית 'השתתפות'</span></h1><br><div style="position: fixed; right: 150px;"><h3><span id="instNameHtml">${users[0].Name}</span> מסניף '<span id="branch">${users[0].Branch}</span>'</span></h3></div></section>`);
    res.write(`<span style="right:150px;"><br><br><br>שלום ${users[0].Name}!<br><br></span><span style="position: static;"><form method='get' name='updatePassword' action='/replacePassword'>הסיסמא הנוכחית שלך: <input type='password' name='firstPassword'><br>סיסמא חדשה (לפחות 6 תוים!):<input type='password' name='newPassword'><input type='hidden' name='user' value="${user}"><br><input type='submit' value='בצע!'></form></span><br><br></body></html>`);
    res.send();
});
////////////////////////////////////////////////////////////////////////////////////////////
app.listen(port, () => console.log(`listening on port ${port}!`));




