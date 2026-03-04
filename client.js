noteBuffer = { };
filters = { }; 
noteHash = -1;
noteMap = new Map();

window.onload = loadPage;

//Set unique color to hashed value
function hashColor(s)
{
    return "hsl("+Math.abs(hash(s))%255+", 86%, 36%)";
}

//Changes date string to an SQL-compatible format
function processDate(date)
{
    return date.toISOString().replace("T", " ").substring(0, 19);
}

//Clears all data in view window, preparing it for adding new note
function addNote()
{
    if(noteBuffer.id != -1) noteSave();
    vwclear();
    document.getElementById("desc").hidden = false;
    document.getElementById("desc_display").hidden = true;
}

//Sets default values for filters
function defaultFilter()
{
    filters.deleted = false;
    filters.hidden = false;
    filters.sortby = "title";
    filters.desc = false;
    filters.match = "";
    filters.matchField = "title";
}

//Function, that plays when page opens
function loadPage()
{
    clearNoteBuffer();
    defaultFilter();
    test();
    refreshPage();

    //Assign event listeners
    document.getElementById("tagin").addEventListener("keypress", async function(event) {
        if(event.key == "Enter" && document.getElementById("tagin").value != "")
        {
            bt = {};
            bt.name = document.getElementById("tagin").value.replaceAll(" ", "_");
            data = { name: bt.name };
            responseData = await postReq("tag/find", data);
            bt.id = responseData.result;
            noteBuffer.tags.push(bt);
            updateTags();
        }
    });
    document.getElementById("flt_match").addEventListener("keyup", async function(event) {
        filters.match = document.getElementById("flt_match").value;
        refreshPage();
    });
    document.getElementById("flt_sortby").addEventListener("change", function(event) {
        filters.sortby = document.getElementById("flt_sortby").value;
        refreshPage();
    });
    document.getElementById("flt_matchby").addEventListener("change", function(event) {
        filters.matchField = document.getElementById("flt_matchby").value;
        refreshPage();
    });
    document.getElementById("flt_sortdir").addEventListener("change", function(event) {
        filters.desc = document.getElementById("flt_sortdir").checked;
        refreshPage();
    });
}

//Update tag view window display
function updateTags()
{
    ih = "";
    noteBuffer.tags.forEach(tag => {
        ih += "<div class=\"tag\" style=\'background-color: "+hashColor(tag.name)+"\' onclick=\"tagDelete(\'"+tag.name+"\')\">"+tag.name+"</div>";
    });
    document.getElementById("tags").innerHTML = ih;
    document.getElementById("tagin").value = "";
}

//Clear view window
function vwclear() {
    clearNoteBuffer();
    document.getElementById("title").value = "";
    document.getElementById("desc").value = "";
    document.getElementById("tagin").value = "";
    document.getElementById("tags").innerHTML = "";
    document.getElementById("desc_display").innerHTML = "";
    refreshPage();
}

//Sets note buffer to default values
function clearNoteBuffer() {
    noteBuffer = {};
    noteBuffer.id = -1;
    noteBuffer.tags = [];
}

//Hash function
function hash(s) {
    let hash = 0;
    for (i = 0, len = s.length; i < len; i++) {
        chr = s.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0;
    }
    return hash;
}

//Toggles the way description gets displayed in view window
function descDisplay() {
    document.getElementById("desc").hidden = !document.getElementById("desc").hidden;
    document.getElementById("desc_display").hidden = !document.getElementById("desc_display").hidden;
    if(!document.getElementById("desc_display").hidden) document.getElementById("desc_display").innerHTML = document.getElementById("desc").value.replaceAll("\n", "<br>");
}

//What happens when you press refresh button
function refresh() {
    refreshPage();
}

//Open note in view window
function noteOpen(id) {
    if(noteBuffer.id != -1) noteSave();
    refreshPage();
    vwclear();
    noteBuffer = JSON.parse(noteMap.get(id+""));
    document.getElementById("title").value = noteBuffer.title;
    document.getElementById("desc_display").innerHTML = noteBuffer.descr.replaceAll("\n", "<br>");
    document.getElementById("desc").value = noteBuffer.descr;
    updateTags();
    noteHash = hash(JSON.stringify(noteBuffer));
    document.getElementById("desc").hidden = true;
    document.getElementById("desc_display").hidden = false;
}

//Toggle fav field for note
function noteFav() {
    noteBuffer.fav = !noteBuffer.fav;
    document.getElementById("notefav").textContent = (!noteBuffer.fav)?"Favourite":"Unfavourite";
}

//Refreshes notes
async function refreshPage()
{
    notes = document.getElementById("notes");
    data = filters;
    responseData = await postReq("page", data);
    console.log('Notes loaded: ', responseData.result.length);

    ih = "";
    if(responseData.result.length == 0) 
    {
        ih += "<div id=\"notes_plhd\">No notes found :(</div>";
    }
    else
    {
        responseData.result.forEach(element => {
            noteMap.set(element.id.toString(), JSON.stringify(element));
            //Changes the way selected note is being displayed
            sel = (element.id == noteBuffer.id)?"style=\"border-style: dashed;\"":"";
            //Changes the way favourite note is being displayed
            fav = (element.fav)?"<span class=\"star\">★</span>":"";
            ih += "<div class=\"note\" id=\"note_"+element.id+"\" "+sel+">"+
                "<div class=\"titlebar\">"+
                    "<div class=\"title\" title=\""+element.title+"\" onclick=\"noteOpen("+element.id+")\"><b>"+fav+element.title+"</b></div>"+
                    "<button class=\"closebt\" onclick=\"noteDelete("+element.id+")\">x</button></div>";
                if(element.tags.length != 0)
                {
                    ih += "<div class=\"tags\" onclick=\"noteOpen("+element.id+")\">";
                    element.tags.forEach(tag => {
                        ih += "<div class=\"tag\" id=\""+element.id+"_"+tag.id+"\" style=\'background-color: "+hashColor(tag.name)+"\'>"+tag.name+"</div>";
                    })
                    ih += "</div>";
                }
                ih += "<div class=\"desc\" onclick=\"noteOpen("+element.id+")\">"+element.descr+"</div>"+
            "</div>";
        });
    }
    notes.innerHTML = ih;
    document.getElementById("notecount").textContent = "notes displayed: "+responseData.result.length;
}

//Creates new not or saves changes in old one
async function noteSave()
{
    noteBuffer.title = document.getElementById("title").value.replaceAll("'", "''");
    noteBuffer.descr = document.getElementById("desc").value.replaceAll("'", "''");
    hash_post = hash(JSON.stringify(noteBuffer));
    if(noteHash != hash_post)
    {
        data = noteBuffer;
        if(noteBuffer.id == -1)
        {
            await postReq("note/add", data);
            vwclear();
        }
        else
        {
            await postReq("note/edit", data);
            document.getElementById("desc_display").innerHTML = noteBuffer.descr.replaceAll("\n", "<br>");
        }
        refreshPage();
    }
    noteHash = hash_post;
}

//Deletes note
async function noteDelete(id) {
    data.id = id;
    responseData = await postReq("note/delete", data);
    console.log('Server response:', responseData.result);
    refreshPage();
}

//Deletes tag from view window
function tagDelete(id) {
    noteBuffer.tags.forEach(tag => {
        if(tag.name == id)
        {
            index = noteBuffer.tags.indexOf(tag);
            noteBuffer.tags.splice(index, 1);
        }
    });
    updateTags();
}

//Test functions for debug purposes
async function test() {
    data = {};
    data.test = "test";
    responseData = await postReq("ctest", data);
    console.log('Server response:', responseData.status);
    responseData = await postReq("dbtest", data);
    console.log('Server response:', responseData.result[0].test_i);
}

//POST query to the server
async function postReq(suffix, data)
{
    const response = await fetch('http://localhost:3000/'+suffix, 
        {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(data)
        });

    const responseData = await response.json();
    return responseData;
}