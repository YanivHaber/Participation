   function drawMembers(json2, inst)
    {
        var membersHtml = "<html lang="heb" dir="rtl"><head><script src=\"/html/protegeActivity.js\">"
<script language="javascript">
var id = "+inst+";
 getMembers(id);
 alert("yaniv");
</script>
<script src="https://code.jquery.com/jquery-3.3.1.min.js"></script></head><body><table><tr><th>������?</th><th>��</tr><form id="form1" action="/editMembers" method="get">";

        try 
        {
            var members = JSON.parse(json2);

            members.forEach(m => 
            {
                membersHtml += "<tr><td>"+m.name+"</td><td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td></tr>";
            });
            membersHtml += "</table>";
            document.getElementById("teamMembers").innerHTML = membersHtml;
        }
        catch(e)
        {
            alert(e);
        }     
    }
