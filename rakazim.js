import { Script } from "vm";

<html>
    <body>
    <select id="rakazim" name="rakazim" 
             onclick="loadRakazim();">
               <option value="s">Select</option>
     </select>

    <Script type="javascript">
        function loadRakazim()
        {
            var http = new XMLHttpRequest();
            var url = "127.0.0.1/instructors.js/selectRakazim";
            http.open("GET", url);
            http.send();

            http.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200)
                {
                    document.write(http.responseText)
                }
            }
        }

            </Script>"
        }
    </script>
     </Script>
    </body>

</html>
