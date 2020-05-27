    <html dir='rtl' lang='heb'>"
     <head>"

     <script src="https://code.jquery.com/jquery-3.3.1.min.js"></script>
     <script language="javascript">"

    
        var varStr = window.location.search.toString();
		var instID = this.varStr.substring(varStr.indexOf("=")+1);

            var instructor = "none";

            function instName()
            {
                $.get("/rakazById?instID="+instID, "", function (json)
                {
                    instructor = json;
                    $("#instructor").textContent = instructor;
                });
            }
     
            function getMembers()
            {
                $.get("membersForInstructor?instID"+instructor, function (json2)
                {
                    var membersHtml = "<table><tr><th>שם</th><th>השתתף בתאריך הנ\"ל?</th></tr>";

                    try 
                    {
                        var members = JSON.parse(json2);
                        alert("adding members...");

                            members.forEach(m => 
                            {
                            membersHtml += "<tr><td>"+m+"</td><td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<input type="checkbox"></td></tr>";
                        });
                        membersHtml += "</table>";
                        $("#membersHtml").textContent = membersHtml;
                    }
                    catch(e)
                    {
                        alert(e);
                    }
                    
            };
        
            </script>
            </head>
            <body onLoad="instName(); getMembers();">
                צור פעולה חדשה עבור המדריך <span id="instructor"></span>:
                <br><br></br></br>
                תאריך הפעולה: <input type="date" name="actDate"></input>
                <br><br></br></br>
                <b>החניכים של מדריך זה:</b>

                <br><br></br></br>
                <span id='membersTable'>
                </span>
            </body>
    </html>