   function drawMembers(json2, inst)
    {
     	avar membersHtml = "<script src="/html/protegeActivity.js"><script language="javascript">
	 getMembers(inst);
</script>
<script src="https://code.jquery.com/jquery-3.3.1.min.js"></script></head><body><table><tr><th>אקטיבי?</th><th>שם</tr><form id="form1" action="/editMembers" method="get">";

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
