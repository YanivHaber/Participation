async function getUserDetails(drawMenu)
{
    try
    {
        var headerLoc = document.getElementById("header");
        
        await $.get("/userName", "", function(json)
        {
            user = JSON.parse(json);
            userId = user.id;
            userName = user.name;
            admin = user.admin;
            branch = user.branch;
            role = user.role;
            tel = user.phone;
            
    
            fetch("../html/header.html")
            .then(response => {
            return response.text()
            })
            .then(data => {
                if (headerLoc != null)
                  headerLoc.innerHTML = data;
                else
                  document.write(data);
            });
        });

        var loc = window.location.href;
        
        if (loc.indexOf("admin") > 0 && admin != 1)
        {
            document.write(`<img class="irc_mi" src="./style/NoEntry.jpg" alt="Image result for no entrance sign" width="260" height="260" style="">`)
            alert("אינך מוגדר אדמיניסטרטור ולכן אינך יכול לגשת לדף זה...");
        }
                //window.setTimeout("afterLoad()", 500);
        window.setTimeout("afterLoad()", 200);
    }
    catch (e)
    {
        
    }
};

function afterLoad()
{
    document.getElementById("username").innerHTML = userName;
    document.getElementById("role").innerHTML = role;
    document.getElementById("phone").innerHTML = tel;
    document.getElementById("branch").innerHTML = branch;
}
