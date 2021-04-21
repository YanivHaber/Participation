
function selectLayer(lay)
{
    //if (lay == "לא הוגדר") lay = "";
    document.getElementById("myTeamForm").submit();
}
function sleep(ms) 
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

    function activateAll()
    {
        var inputs = document.getElementsByTagName("input");
        for (x = 0 ; x < inputs.length ; x++)
        {
            myname = inputs[x].id;
            if(myname.substring(0, 3) == "ID-")
            {
                inputs[x].checked = true;
                setChangeVars(inputs[x].id)
            }
        }
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

function alertMe()
{
    alert('alerted!');
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

async function deactivateMembers()
{
    await deactivateOnServer();
    alert("בחירתך נשמרה...");
    window.parent.location.reload();
}

async function deactivateOnServer()
{
    var url = "/deactivateUsers?" + changedVars;
    var res = "";
    try
    {
        $.get(url, function (retSon) 
        {
            alert("done: "+retSon); 
            alert('reloading...'); 
        });
    }
    catch (e) 
    {
        alert(e);
    }                
}


function getMembers(inst)
{
    if (inst < 0) return;
    $.get("/membersForInstructor?instID="+inst, function (json2)
    {
        drawMembers(json2, inst);
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
        var link2 =`http://${window.location.hostname}:1000/html/re-activateUsers.html`;
        //document.getElementById("link1").href = `http://${window.location.hostname}:1000/html/membersForRakaz.html?instID=`+userId;
        //document.getElementById("link2").href = `http://${window.location.hostname}:1000/html/re-activateUsers.html`;
        
    });*/
};

function drawMembers(json2, inst)
{    
    getUserDetails();
    
    var membersHtml = `<table><br><tr><th>חניך</th><th>אקטיבי?</th></tr><br> סה"כ חניכים אקטיביים (בשכבה 'שכבהפה'): <span id="activeMembers"></span><br>חניכים שהפסיקו השתתפותם (הפכו ל'לא אקטיביים'): <span id="nonActive"></span><br>`;

    try 
    {
        var members = JSON.parse(json2);
        if (members.length == 0) 
        {
            membersHtml = "<font color='red'>!This user DOES NOT HAVE ANY members</font>";
            return membersHtml;
        }
        var activeMembers = 0;
        var nonActive = 0;

        // draw active members
        members.forEach(m => 
        {
            if (m.active != "TRUE") nonActive++;

            activeMembers++;
            membersHtml += "<tr><td>"+m.name+"</td><td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>";
            var chkbox = `<input id=\"ID-${m.memberID}" name=\"ID-${m.memberID}" type="checkbox" onclick="" `+((m.active== "TRUE")? "checked": "")+` disabled>`;
            if (m.active != "TRUE") chkbox = `&nbsp;<span style="color:red">X</span>`;
            membersHtml += "<td>"+chkbox+"</td></tr>";
        });
        // draw NON active members
        members.forEach(m => 
        {
            if (!m.active)
            {                
                membersHtml += "<tr><td>"+m.name+"</td><td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td></tr>";
            }
        });

        queryString = window.location.search;
        urlParams = new URLSearchParams(queryString);
        filterLayer = urlParams.get('filterLayer');
        if (filterLayer == null) filterLayer = "כולם";

        membersHtml += "</table>";
        var innerPoint = membersHtml.indexOf(`"activeMembers">`) + `"activeMembers">`.length;
        membersHtml = membersHtml.substring(0, innerPoint) + activeMembers + membersHtml.substring(innerPoint);
        innerPoint = membersHtml.indexOf(`שכבהפה`);
        membersHtml = membersHtml.substring(0, innerPoint) + filterLayer + membersHtml.substring(innerPoint+6);
        innerPoint = membersHtml.indexOf(`"nonActive">`) + `"nonActive">`.length;
        membersHtml = membersHtml.substring(0, innerPoint) + nonActive + membersHtml.substring(innerPoint);

        return membersHtml;
    }
    catch(e)
    {
        alert(e);
    }     
}