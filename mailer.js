const express = require('express')
const app = express();

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//app.get('/sendMail', async (req, res) => 
function notify(id, userName, password, mail)
{
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
            user: 'yaniv@krembo.org.il',
            pass: 'O2m5er!2'

        }
    });

    var mailOptions = 
    {
        from: 'yaniv@krembo.org.il',
        to: mail,
        subject: 'Account was created for you in the Krembo user participation app!',
        html: '<html lang="he" dir="rtl">נוצר עבורך חשבון באפליקצייה שמאפשרת שמירת דוחות נוכחות החניכים בפעולות! כדי להיכנס לאפליקציה (מהמחשב או הנייד) היכנס ללינק זה: <br>http://yanivh-lapton:1000/html/instructorLinks.html<br><br><h2>(עדיף לחכות למצב שיניב יהיה במשרד עם לפטופ מחובר לרשת לפני שמקליקים...)</h2>'    
    };

    mailOptions.html += "<br><br> שם משתמש וסיסמא ראשונית נוצרו לכם כך:<br>";
    mailOptions.html += "<br><b>username</b>="+userName + ", <b>password</b>='"+password+`"'" <br><br> כדי להחליף סיסמא לחץ על לינק זה: http://yanivh-lapton:${sitePort}/changePassword?user=`+id;
    
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
///////////////////////////////////////////////////////////////////////////////////////////////////

notify(100, "yaniv", "ניסוי!", "yaniv@krembo.org.il");