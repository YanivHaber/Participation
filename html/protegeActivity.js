
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


function deactivateMembers(inst)
{
    var url = "/deactivateUsers?" + changedVars;
    var res = "";
    $.get(url, function (json2)
    {
        alert(json2);
    });
    $.get("/membersForInstructor?instID="+inst, function (json2)
    {
        var reHtml =  drawMembers(json2, inst);
        window.parent.document.getElementById("main").srcdoc = "<button id='deactivateMembers' type=\"button\" onclick=\"deactivateMembers()\">הפוך חניכים ל'לא אקטיביים'!</button><button id=\"selAll\" type=\"button\" onclick=\"selectAll()\" value=\"\">הפוך את הבחירה בכווווווולם!</button>"+reHtml;
    });
}

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

function drawMembers(json2, inst)
{
    var membersHtml = "<html lang=\"heb\" dir=\"rtl\"><head><script src=\"/html/protegeActivity.js\"><script language=\"javascript\">var id = "+inst+"; getMembers(id);</sc"+"ript\"></sc"+"ript><script src=\"https://code.jquery.com/jquery-3.3.1.min.js\"></sc"+"ript></head><body><table><tr><th>אקטיבי?</th><th>שם</tr><form id=\"form1\" action=\"/editMembers\" method=\"get\">";

    try 
    {
        var members = JSON.parse(json2);

        members.forEach(m => 
        {
            membersHtml += "<tr><td><input id=\"ID-"+m.memberID+"\" name=\"ID-"+m.memberID+"\" type=\"checkbox\" onclick=\"setChangeVars('ID-"+m.memberID+"')\" checked></td><td>"+m.name+"</td><td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td></tr>";
        });
        membersHtml += "</table>";
        return membersHtml;
        //document.getElementById("submitButt").style.visibility = "visible";
    }
    catch(e)
    {
        alert(e);
    }     
}
