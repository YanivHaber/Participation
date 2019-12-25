
function selectLayer(lay)
{
    document.getElementById("myTeamForm").submit();
}
function sleep(ms) 
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

function selectAll()
{
    var boxes = document.getElementsByTagName("input");
    for (i = 0; i < boxes.length; i++)
    {
        if (boxes[i].type == "checkbox")
        {
            boxes[i].checked = !boxes[i].checked;
        }
    }
}

var changedVars = "";

function setChangeVars(checkId)
{
    var chk = document.getElementById(checkId);
    var loc = changedVars.indexOf(chk.id);
    if (loc > 0)
    {
        var loc2 = changedVars.indexOf("&", loc);
        changedVars = changedVars.substring(0, loc) + changedVars.substring(loc2);
    }
    else
    {
        if (changedVars.length > 0) changedVars += "&";
        changedVars += chk.id + "=" + chk.checked;
    }

}

function getMembers(inst)
{
    $.get("/membersForInstructor?instID="+inst, function (json2)
    {
        drawMembers(json2);
    });
}


var userId = -1;
var instructor = "";
var admin = 0;
var userName = "";

var district = "";

async function getUserDetails()
{    
    /*
    $.get("/userName", "", function(json)
    {
        user = JSON.parse(json);
        userId = user.id;
        userName = user.name;
        admin = user.admin;
        district = user.district;

        //alert("user ''"+userName+"'' is "+(user.admin == 1? "": "NOT an ")+"admin!");
        //document.getElementById("instNameHtml").innerHTML = userName;
        
        //document.getElementById("branch").innerHTML = district;
        //document.getElementById("link1").href = "http://127.0.0.1:1000/html/membersForRakaz.html?instID="+userId;
        //document.getElementById("link2").href = "http://127.0.0.1:1000/html/re-activateUsers.html";
        
    });*/
};

function drawMembers(json2, inst)
{
    
    getUserDetails();
    
    var membersHtml = `<table><br><tr><th>חניך</th></tr><br> סה"כ חניכים אקטיביים: <span id="activeMembers"></span><br>חניכים שהפסיקו השתתפותם: <span id="nonActive"></span><br>`;

    try 
    {
        var members = JSON.parse(json2);
        var activeMembers = 0;
        var nonActive = 0;

        // draw active members
        members.forEach(m => 
        {
            if (m.active== "1")
            {
                activeMembers++;
                membersHtml += "<tr><td>"+m.name+"</td><td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td></tr>";
            }
            else
            {
                nonActive++;
            }
        });
        // draw NON active members
        members.forEach(m => 
        {
            if (!m.active)
            {                
                membersHtml += "<tr><td>"+m.name+"</td><td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td></tr>";
            }
        });

        membersHtml += "</table>";
        var innerPoint = membersHtml.indexOf(`"activeMembers">`) + `"activeMembers">`.length;
        membersHtml = membersHtml.substring(0, innerPoint) + activeMembers + membersHtml.substring(innerPoint);
        innerPoint = membersHtml.indexOf(`"nonActive">`) + `"nonActive">`.length;
        membersHtml = membersHtml.substring(0, innerPoint) + nonActive + membersHtml.substring(innerPoint);

        
        return membersHtml;
    }
    catch(e)
    {
        alert(e);
    }     
}