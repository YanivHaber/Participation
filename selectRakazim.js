app.get('/selectRakazim', async (req, res) => {
    res.header("Content-Type", "text/html; charset=utf-8");
    //res.write("<body dir=\"rtl\">");
    console.log("show rakazim selectbox");


    try {
        let rows = await query("Select * from Rakazim");

        res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});

        for (let i = 0; i < rows.length; i++) {
            //console.log("*******************  " + JSON.stringify(rows));
            res.write("<option>");
            res.write(rows[i].Name);
            res.write("</option>");
        }

        res.send();
    } catch (e) {
        console.log("failed to retrieve info from Rakazime table: " + e);
    }

   

}
