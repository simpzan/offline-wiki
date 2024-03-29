function incrementSlider(pagesDelta){
  var step = document.getElementById('slider').step - 0;
  document.getElementById('slider').value -= pagesDelta * -step;
  /*
  do {
    document.getElementById('slider').value -= pagesDelta * -step;
  } while((!index.checkBlock(+document.getElementById('slider').value)));
  */
  updateIndex();
}

function updateIndex(){
  var val = document.getElementById('slider').value - 0;
  var step = document.getElementById('slider').step - 0;
  var max = document.getElementById('slider').max - 0;  
  lastArticlePos = val + step/2;
  
  t(document.getElementById('title'), "Index: "+(1+(val/step))+" of "+Math.floor(1+(max/step)));  
  index.readText(val - 200, step + 200, function(text){
    var content = 'Data Inaccessible or Corrupt';
    if(text){
      content = text.split('\n').slice(1, -1).map(function(x){
        var title = x.split(/\||>/)[0];
        var pos = parse64(x.split(/\||>/)[1]);
        return '<a href="?'+title+'" title="'+pos+'" class="'+((!isNaN(pos) && dump.checkBlock(pos))?'':'notcached')+'">'+title+'</a>';
      }).join("<br>")
    }
    document.getElementById('pageitems').innerHTML = '<a href="javascript:incrementSlider(-1)" class="prev">Previous</a> / <a class="next" href="javascript:incrementSlider(1)">Next</a><br>' + content;
  });
}

var lastArticlePos = 0;

function loadArticle(query){
  if(lastArticle == query) return;
  console.log("load article", query);
  lastArticle = query;
  query = query.replace(/w(ikipedia)?:/,'');
  query = query.replace(/_/g, ' ');
  if(query == ''){
    return;
  }

  if(query == 'Special:Settings'){
    document.getElementById('settings').style.display = ''
    document.getElementById('content').style.display = 'none'
    document.title = t(document.getElementById('title'), "Settings"); 
    document.getElementById('outline').innerHTML = '';
    return;
  }
  document.getElementById('settings').style.display = 'none'
  document.getElementById('content').style.display = ''
  if(query == 'Special:Random'){
    /*var ch = 0;
    if(index.getChunks() == index.popcount()){
      ch = Math.floor(index.getChunks() * Math.random());
    }else{
      for(var a = [], l = index.getChunks(); l--;){
        if(index.checkChunk(l)) a.push(l);
      }
      ch = a[Math.floor(a.length * Math.random())]
    }*/
    var online = true;
    function randomPage(){
      index.readText(Math.floor(indexsize() * Math.random()), 400, function(text){
        if(text == false && online){
          online = false;
          console.log('online mode is off');
        }
        var title = text && text.split('\n').slice(1,-1).filter(function(x){
            return !/\>/.test(x)
          });
        if(title && title.length){
          var parts = title[Math.floor(title.length * Math.random())].split(/\||\>/);
          if(dump.checkBlock(parse64(parts[1])) || online){
            loadArticle(parts[0]);
          }else{
            randomPage();
          }
        }else{
          randomPage();
        }
      });
    }
    randomPage();
    t(document.getElementById('title'), "Special:Random");  
    return;
  }
  if(query == 'Special:Index'){
    /*if(accessibleIndex == 0) return setTimeout(function(){
      loadArticle(query);
    }, 100);*/
    t(document.getElementById('title'), "Index"); 
    document.title = "Index";
    document.getElementById('content').innerHTML = "<input type=range id=slider> <div id=pageitems>";

    var step = Math.floor((innerHeight - 80) * document.getElementById('content').scrollWidth/271.828 );
    document.getElementById('slider').max = Math.floor(indexsize()/step)*step;
    document.getElementById('slider').step = step;
    document.getElementById('slider').value = Math.floor(lastArticlePos/step) * step;

    var lastTime = 0;
    document.getElementById('slider').onchange = function(){
      lastTime = +new Date;
      var closureTime = lastTime;
      setTimeout(function(){
        if(closureTime >= lastTime) updateIndex();
      }, 200)
    }
    document.getElementById('outline').innerHTML = '';
    updateIndex();
    return;
  }
  if(query == 'Special:Dump'){
    t(document.getElementById('title'), "Dump Info"); 
    document.title = "About Dump";
    document.getElementById('content').innerHTML = "<h1>Dump Information</h1> Dump Size: " + dumpsize() + "<br>Index Size: " + indexsize() +
     "<p>You're probably seeing this page because you have loaded a dump/index pair manually. ";
    document.getElementById('outline').innerHTML = '';
    return;
  }
  t(document.getElementById('title'), "Loading...");  
  reposition();
  
  //console.log("loading article", query)
  readArticle(query, function(title, text, pos){
    lastArticle = title;
    
    if(document.title != title){
      history.replaceState({}, '', '?'+title.replace(/ |%20/g,'_'));
      scrollTo(0,0);
    };


    document.title = title;
    t(document.getElementById('title'), title); 

    if(pos) lastArticlePos = pos;
    reposition();
    
    renderWikitext(text, function(html){
      //var parse_start = +new Date;
      document.getElementById('content').innerHTML = html;
      localStorage.lastArticleHTML = html;
      localStorage.lastArticleTitle = title;
      //console.log("Article Reflow time", +new Date - parse_start);      
      parseBoxes();
      updateOutline();
      selectOutline();
      checkLink();
      checkLinkUncached();
    });
      
  })
}

function parseBoxes(){
  var box = document.querySelector('.wikibox');
  if(box){
    box.className = '';
    var parts = t(box).split(/[>|]/);
    var fn = parts.shift().toLowerCase();
    if(fn == 'main'){
      box.innerHTML = '<div class="rellink">Main articles: '+parts.map(function(e){
        return '<a href="?'+e+'">'+e+'</a>';
      }).join(', ')+'</div>'
    }else if(fn == 'see'){
      box.innerHTML = '<div class="rellink">Further information: '+parts.map(function(e){
        return '<a href="?'+e+'">'+e+'</a>';
      }).join(', ')+'</div>'
    }else if(fn == 'convert'){
      box.innerHTML = parts[0] + ' ' + parts[1].replace(/e\d/, function(a){
        return ({
          e6: 'million',
          e9: 'billion'
        })[a] + ' '
      })
    }else if(fn == 'ipa-en'){
      box.innerHTML = '<small>English pronunciation:</small> <a href="?Wikipedia:IPA_for_English">/'+parts[0]+'/</a>';
    }else{
      box.className = 'unknown_box';
    }
    parseBoxes();
  }
}




function updateOutline(){
  var els = document.getElementById('content').querySelectorAll('h1,h2,h3,h4,h5,h6');
  var ol = document.createElement('ol');
  document.getElementById('outline').innerHTML = '';
  document.getElementById('outline').appendChild(ol);
  var lastnum = 2;
  for(var i = 0; i < els.length; i++){
    if(t(els[i]).replace(/[^\<\>\"\'\&;_%\+\=\[\]]/g,'').length > 1) continue;
    var num = parseInt(els[i].tagName.replace(/[^0-9]/g, ''));
    if(num > lastnum){
      var nol = document.createElement('ol');
      ol.appendChild(nol);
      ol = nol;
    }else if(num < lastnum){
      ol = ol.parentNode;
    }
    var lye = document.createElement('li');
    var lynk = document.createElement('a');
    lye.appendChild(lynk);
    els[i].id = t(els[i]).replace(/[^\w]/g, '');
    els[i].link = lynk;
    lynk.href = '#'+els[i].id;
    t(lynk,t(els[i]));
    ol.appendChild(lye);
    lastnum = num
  }
}

var redirectCache = {};
var linkCache = {};

function checkLink(){
  if(document.title == 'Index') return;
  var link;
  while(link = document.getElementById('content').querySelector('a:not(.checked)')){
    var url = unescape(link.href.replace(/^.*\?|\#.*$/g,'')).toLowerCase().replace(/[^a-z0-9]/g,'');
    //console.log(url);
    if(linkCache[url]){
      if(linkCache[url] == -1){
        link.className += ' new ';
      }
      link.className += ' cached ';
    }
    link.className += ' checked ';
  }
}

function checkLinkUncached(){
  if(index.progress() < 1) return;
  if(document.title == 'Index') return;
  var link = document.getElementById('content').querySelector('a:not(.cached)');
  if(link && document.title != 'Index'){
    var url = unescape(link.href.replace(/^.*\?|\#.*$/g,'')).toLowerCase().replace(/[^a-z0-9]/g,'');
    runSearch(url, function(r){
      linkCache[url] = -1;
      if(r){
        r.forEach(function(e){
          linkCache[e.replace(/(>|\|).*$/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')] = 1;
        });
      }
      if(linkCache[url] == -1){
        link.className += ' new '
      }
      link.className += ' cached ';
      setTimeout(checkLinkUncached, 14);
    }, 2);
  }
}


document.body.onclick = function(e){
  if(e.button == 0  ){
    var link = null;
    if(e.target.tagName.toLowerCase() == 'a'){
      link = e.target;
    }else if(e.target.parentNode.tagName.toLowerCase() == 'a'){
      link = e.target.parentNode;
    }
    if(link){
      if(link.href.replace(/\?.*$/,'') == location.href.replace(/\?.*$/,'')){
        if(unescape(link.href.replace(/\#.*$/,'')) == unescape(location.href.replace(/\#.*$/,'')) && unescape(link.href) != unescape(location.href)){
          return true;
        }
        e.preventDefault();
        history.pushState({}, '', link.href.replace(/ |%20/g,'_'));
        loadArticle(decodeURIComponent(location.search.substr(1)))
      }
    }
  }
}

function pophandler(e){
  var title = decodeURIComponent(location.search.substr(1));
  if(lastArticle != title){
    loadArticle(title)
  } 
}

onpopstate = pophandler;

if(decodeURIComponent(location.search.substr(1)) == localStorage.lastArticleTitle){
  document.getElementById('content').innerHTML = localStorage.lastArticleHTML;
}

setTimeout(function(){
  pophandler();
},100);

onscroll = function(){
  selectOutline();
}

function selectOutline(){
  var z;
  while(z = document.querySelector('a.selected')) z.className = '';
  
  try{
    var els = document.getElementById('content').querySelectorAll('h1,h2,h3,h4,h5,h6');
    var i = 0;
    while(findPos(els[i])[1] < scrollY) i++;
    els[i].link.className = 'selected';
  }catch(err){};
}


var articleCache = {};


function readArticle(query, callback){
  //console.log("read article", query);
  /*if(accessibleIndex < 100) return setTimeout(function(){
    readArticle(query, callback);
  }, 10);*/
  findBlock(query, function(title, position, location){
    title = title.trim();
    if(location < 0){
      var msg = 'An unknown error occurred in searching for the page.';
      if(location == -13) msg = 'No page with such a title was found in the index. Try switching to [[Special:Settings|the more inclusive dump]].'
      if(location == -29) msg = 'This page was caught in an infinite redirect loop.';
      return callback(title, "==Page Not Found==\n\n"+msg, 0);
    }
    //console.log(title, title in articleCache)
    if(title in articleCache && articleCache[title]) return callback(title, articleCache[title], location);
    dump.readBlock(position, 200000, function(buf){
      decompressPage(buf, function(){
        callback(title, articleCache[title] || (
          "==Page Not Found==\n\n"+(
            (title in articleCache)
              ? "The page exists in the archive, but decompression yielded an empty page."
              : "The page was found in the index, but not found in the archive.")
        ), location);
      });
    })
  })
}

