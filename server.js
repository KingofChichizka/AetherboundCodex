const Database = require('better-sqlite3');
const express = require('express');
const cors = require('cors');

const db = new Database('ae.db');
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

//Deletes tags with no notes that use them
function cleanStrayTags() {
  query = db.prepare('DELETE FROM tags WHERE (SELECT count(t.id) FROM tagrel t WHERE t.id_tag = tags.id) = 0');
  qres = query.run();
}

//Connection to server test
app.post('/ctest', (req, res) => {
  const clientData = req.body;
  console.log('Received data from client:', clientData);

  res.status(200).json({
    status: 'success'
  });
});

//Connection to database test
app.post('/dbtest', (req, res) => {
  const clientData = req.body;

  dbresult = db.prepare('SELECT * FROM test').all();

  res.status(200).json({
    result: dbresult
  });
});

//Get notes to display on page
app.post('/page', (req, res) => {
  clientData = req.body;
  
  if(clientData.matchField == "tag" && clientData.match == "") clientData.matchField = "title";
  desc = ((clientData.desc && (clientData.sortby != "date_ed" && clientData.sortby != "date_cr")) || (!clientData.desc && (clientData.sortby == "date_ed" || clientData.sortby == "date_cr")))?" DESC":"";
  match = " AND "+clientData.matchField+" LIKE \'%"+clientData.match+"%\'";

  dbresult = {};
  if(clientData.matchField != "tag") dbresult = db.prepare('SELECT * FROM notes WHERE id != 0 AND del = '+clientData.deleted+' '+match+' ORDER BY fav DESC, '+clientData.sortby+' COLLATE NOCASE'+desc).all();
  else 
  {
    tags = clientData.match.split(" ");
    tagstr = " (tt.name LIKE \'%"+tags[tags.length-1]+"%\'";
    //tagstr = " (tt.name = \'"+tags[tags.length-1]+"\'";
    multagsuppl = "";
    if(tags.length > 1) 
    {
      for(i = tags.length-2; i >= 0; i--)
      {
        tagstr += " OR tt.name = \'"+tags[i]+"\'";
      }
      multagsuppl = " GROUP BY n.id HAVING count(*) > 1";
    }
    tagstr += ")"
    dbresult = db.prepare('SELECT DISTINCT n.* FROM notes n JOIN tagrel t ON t.id_note = n.id JOIN tags tt ON tt.id = t.id_tag WHERE '+tagstr+' AND n.id != 0 AND del = '+clientData.deleted+' '+multagsuppl+' ORDER BY fav DESC, n.'+clientData.sortby+' COLLATE NOCASE'+desc).all();
  }

  dbresult.forEach(element => {
    element.tags = db.prepare('SELECT (SELECT t.name FROM tags t WHERE t.id = id_tag) AS name, id_tag AS id FROM tagrel WHERE id_note = '+element.id+' ORDER BY (SELECT t.name FROM tags t WHERE t.id = id_tag)').all();
  });

  res.status(200).json({
    result: dbresult
  });
});

//Find tag by id
app.post('/tag/find', (req, res) => {
  const clientData = req.body;

  dbresult = {};
  dbresult = db.prepare('SELECT id FROM tags WHERE name = \''+clientData.name+'\'').all();
  if(dbresult.length == 0) id = -1;
  else id = dbresult[0].id;

  res.status(200).json({
    result: id
  });
});

//Mark note as deleted
app.post('/note/delete', (req, res) => {
  const clientData = req.body;

  query = db.prepare('UPDATE notes SET del = true WHERE id = '+clientData.id);
  qres = query.run();

  res.status(200).json({
    result: qres
  });
});

//Add note to database
app.post('/note/add', (req, res) => {
  const clientData = req.body;

  dbresult = {};
  query = db.prepare('INSERT INTO notes(title, descr, date_cr, date_ed) VALUES(\''+clientData.title+'\', \''+clientData.descr+'\', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');
  qres = query.run();
  id = qres.lastInsertRowid;

  if(clientData.tags.length != 0)
  {
    clientData.tags.forEach(tag => {
      currtag = tag.id;
      if(tag.id == -1)
      {
        query = db.prepare('INSERT INTO tags(name) VALUES(\''+tag.name+'\')');
        currtag = query.run().lastInsertRowid;
      }
      query = db.prepare('INSERT INTO tagrel(id_note, id_tag) VALUES(\''+id+'\', \''+currtag+'\')');
      query.run();
    });
  } 

  res.status(200).json({
    result: id
  });

});

//Edit existing note
app.post('/note/edit', (req, res) => {
  const clientData = req.body;
  console.log(clientData);
  dbresult = {};
  test1 = 0;
  test2 = 0;
  query = db.prepare('UPDATE notes SET title = \''+clientData.title+'\', descr = \''+clientData.descr+'\', fav = '+clientData.fav+', date_ed = CURRENT_TIMESTAMP WHERE id = '+clientData.id);
  qres = query.run();
  id = clientData.id;

  if(clientData.tags.length != 0)
  {
    taglist = "-22";
    clientData.tags.forEach(tag => {
      currtag = tag.id;
      if(currtag == -1)
      {
        query = db.prepare('INSERT INTO tags(name) VALUES(\''+tag.name+'\')');
        currtag = query.run().lastInsertRowid;
      }
      taglist += ","+currtag;
      test1 = currtag;
      test2 = id;
      dbresult = db.prepare('SELECT id FROM tagrel WHERE id_tag = '+currtag+' AND id_note = '+id).all();
      if(dbresult.length == 0){
        query = db.prepare('INSERT INTO tagrel(id_note, id_tag) VALUES('+id+', '+currtag+')');
        query.run();
      }
    });
    if(taglist != "-22")
    {
      dbresult = db.prepare('SELECT id FROM tagrel WHERE id_tag NOT IN('+taglist+') AND id_note = '+id).all();
      dbresult.forEach(tag => {
        query = db.prepare('DELETE FROM tagrel WHERE id = '+tag.id);
        qres = query.run();
      });
    }
  } 
  else 
  {
    query = db.prepare('DELETE FROM tagrel WHERE id_note = '+clientData.id);
    qres = query.run();
  }
  cleanStrayTags();

  res.status(200).json({
    result: dbresult.notes
  });
});

app.listen(port, () => {
  console.log('Ætherbound codex server is up and running at http://localhost:'+port);
});