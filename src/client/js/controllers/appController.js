export default class AppController {

  constructor($scope, $socket, $http, $sce) {

    var _this = this;
    _this.$scope = $scope;
    _this.$http = $http;
    _this.$sce = $sce;
    _this.$socket = $socket;

    var d = new Date();
    _this.$scope.my_cursor_id = d.getTime();
    _this.$scope.cursors = {};

    _this.$scope.mode_values = ['text', 'html','css','javascript','php','python','ruby','c_cpp','csharp','java','objectivec','actionscript','coffee','typescript','batchfile','haml','handlebars','haskell','jade','json','jsx','less','sass','scss','stylus','livescript','markdown','mysql','sql','pascal','perl','rust','sh','svg','textile','vbscript','xml'];
    _this.$scope.mode_names = ['Text', 'HTML','CSS','JavaScript','PHP','Python','Ruby','C++','C#','Java','Objective C','ActionScript','CoffeeScript','TypeScript','Batchfile','Haml','Handlebars','Haskell','Jade','JSON','JSX','LESS','SASS','SCSS','Stylus','LiveScript','Markdown','MySQL','SQL','Pascal','Perl','Rust','Shell (Bash)','SVG','Textfile','VBScript','XML'];

    _this.$scope.currentCID = location.pathname.replace('/','');
    _this.$scope.currentCode = null;
    _this.$scope.currentMode = 'text';
    _this.$scope.currentTheme = 'tomorrow_night_eighties'; // chrome

    _this.$scope.editor = ace.edit('editor');
    _this.$scope.editor.setTheme('ace/theme/' + _this.$scope.currentTheme);
    _this.$scope.editor.session.setMode('ace/mode/' + _this.$scope.currentMode);
    _this.$scope.editor.renderer.setPadding(10);
    _this.$scope.editor.$blockScrolling = Infinity;
    _this.$scope.editor.setOption('enableEmmet', true);

    _this.$scope.editor.commands.addCommand({
      name: 'popup_cmd',
      bindKey: {win: 'Ctrl-Shift-P', mac: 'Command-Shift-P'},
      exec: function(editor) {

        $d.get('.search-box input')[0].value = _this.$scope.search_cmd = '';

        _this.$scope.commands = _this.$scope.commands_rec;
        _this.$scope.search_cmd = '';
        _this.$scope.cdnjs_files = [];

        setTimeout(function() {
          $d.get('.search-box input')[0].focus();
        });

        _this.$scope.command_show = true;
        _this.$scope.$apply();

      },
      readOnly: true
    });

    _this.$scope.editor.commands.addCommand({
      name: 'close_popup',
      bindKey: {win: 'Esc', mac: 'Esc'},
      exec: function(editor) {
        _this.$scope.command_show = false;
        _this.$scope.$apply();
      },
      readOnly: true
    });

    _this.$scope.debounceEditor = null;
    _this.$scope.waitEditor = null;
    _this.$scope.isSaving = false;
    _this.$scope.saveDelay = 1500;

    _this.$scope.codeUrl = location.href;
    _this.$scope.cursorPos = 'Line 0, Column 0';
    _this.$scope.codeRunned = false;
    _this.$scope.autoRun = false;

    _this.$scope.commands = [
      {value: 'Cdnjs: Search', cmd: 'cdnjs:search'},
      {value: 'Snippet: for (...) { }', cmd: 'snippet:for'},
      {value: 'Random: Int', cmd: 'random:int'},
      {value: 'Random: Float', cmd: 'random:float'},
      {value: 'Random: Text', cmd: 'random:text'},
      {value: 'Random: UUID', cmd: 'random:uuid'},
      {value: 'Random: URL', cmd: 'random:url'},
      {value: 'Random: E-Mail', cmd: 'random:email'},
      {value: 'Random: First Name', cmd: 'random:firstname'},
      {value: 'Random: Last Name', cmd: 'random:lastname'},
      {value: 'Random: Full Name', cmd: 'random:fullname'},
      {value: 'Random: Hex-Color', cmd: 'random:hex'},
      {value: 'Random: IPv4 Adress', cmd: 'random:ip4'},
      {value: 'Random: IPv6 Adress', cmd: 'random:ip6'},
      {value: 'Random: Lorem Ipsum', cmd: 'random:lorem'},
      {value: 'Random: Letters and numbers', cmd: 'random:letnum'}
    ];

    _this.$scope.commands_rec = _this.$scope.commands;

    _this.$scope.command_show = false;
    _this.$scope.search_cmd = '';
    _this.$scope.cdnjs_files = [];

    // Get the source code
    _this.$http.get('/get'+location.pathname).success((data) => {
      // Пихаем ответ от сервера в переменную
      _this.setCode(data.data);
    });

    // If you change the display / hide code view, send a request for saving
    _this.$scope.$watch('codeRunned', (newValue, oldValue) => {
      if (newValue == oldValue) {return false}
      if (newValue) {this.writeCode()}
      _this.$socket.emit('server:editor:viewer', {
        type: 'viewer',
        cid: _this.$scope.currentCID,
        status: newValue ? 1 : 0
      });
    });


    // If you change the autorun code, send a request for saving
    _this.$scope.$watch('autoRun', (newValue, oldValue) => {
      if (newValue == oldValue) {return false}
      if (newValue) {this.writeCode()}
      _this.$socket.emit('server:editor:viewer', {
        type: 'autorun',
        cid: _this.$scope.currentCID,
        status: newValue ? 1 : 0
      });
    });

    // We follow the change in the syntax of the editor
    _this.$scope.$watch('currentMode', (newValue, oldValue) => {
      if (newValue == oldValue) {return false}
      // We tell the server that we changed the syntax
      _this.$socket.emit('server:editor:mode', {
        cid: _this.$scope.currentCID,
        mode: newValue
      });

      // Save the new syntax value
      _this.$scope.currentMode = newValue;

      // Install a new syntax for the editor
      _this.$scope.editor.getSession().setMode('ace/mode/' + _this.$scope.currentMode);

      // Save changes
      // setTimeout( () => { _this.saveCode() },500);
    });

    // We follow the syntax change from other users
    _this.$socket.on('client:editor:mode', (data) => {
      // Ping the response from the server to the variable
      if (data.cid == _this.$scope.currentCID)
      {_this.$scope.currentMode = data.mode}
    });

    // Other users sent cursor socket
    _this.$socket.on('client:editor:cursor', (data) => {
      // Make sure we are on the same page ID as other user
      if (data.cid == _this.$scope.currentCID) {

        // Cursor exists
        if (_this.$scope.cursors[data.cursor_id]) {

          // Cursor position changed
          if (_this.$scope.cursors[data.cursor_id].pos.x != data.cursor.x
            || _this.$scope.cursors[data.cursor_id].pos.y != data.cursor.y) {

            // Remove their old cursor
            if (_this.$scope.cursors[data.cursor_id].marker) {
              _this.$scope.editor.session.removeMarker(_this.$scope.cursors[data.cursor_id].marker);
            }
          }
          // Cursor position still same
          else {
            return;
          }
        }
        // Cursor did not exist
        else {
          _this.$scope.cursors[data.cursor_id] = {};
        }

        // Re-draw their cursor
        if (data.cursor.x != -1) {
          var marker_id = _this.drawOtherCursor(data.cursor.x, data.cursor.y);
          _this.$scope.cursors[data.cursor_id].marker = marker_id;
          _this.$scope.cursors[data.cursor_id].pos = data.cursor;
        }

      }
    });

    // // We moved cursor
    // _this.$scope.editor.on('changeCursor', function(e) {
    //   var pos = _this.$scope.editor.getCursorPosition();
    //   _this.$socket.emit('server:editor:cursor', {
    //     cid: _this.$scope.currentCID,
    //     cursor: {x: pos.row, y:pos.column},
    //     cursor_id: _this.$scope.my_cursor_id
    //   });
    // });

    // We focused in the editor
    _this.$scope.editor.on('focus', (e) => {
      var pos = _this.$scope.editor.getCursorPosition();
      _this.$scope.cursorPos = 'Line ' + pos.row + ', Column ' + pos.column;
      _this.$scope.$apply();
    });

    // We typed in the editor
    _this.$scope.editor.on('change', (e) => {

      // If the changes on our part
      if (_this.$scope.editor.curOp && _this.$scope.editor.curOp.command.name) {

        // Clearing the save timer
        clearTimeout(_this.$scope.debounceEditor);

        // Get the object of the editor's session
        var session = _this.$scope.editor.session;

        // Notify about changes
        _this.$socket.emit('server:editor:change', {
          cid: _this.$scope.currentCID,
          mode: _this.$scope.currentMode,
          code: btoa(unescape(encodeURIComponent(session.getValue())))
        });

        _this.$scope.currentCode = session.getValue();

        if (_this.$scope.autoRun == true && _this.$scope.currentMode == 'html') {
          this.writeCode();
        }

        // Set the timer to save the code
        _this.$scope.debounceEditor = setTimeout(() => {
          _this.saveCode();
        }, _this.$scope.saveDelay);

      }
    });

    // Watch for changes in the code
    _this.$socket.on('client:editor:change', (data) => {
      // Making changes in the code
      if (_this.$scope.currentCID == data.cid) {
        _this.setCode(data);
        // console.log(data);
      }
    });

    window.onresize = resizeEditor;

    // Send closing signal by saying cursor position is -1
    $(window).on('beforeunload', function() {
      // Do not emit our cursor position anymore after this
      clearInterval(_this.$scope.cursor_interval);
      _this.$socket.emit('server:editor:cursor', {
        cid: _this.$scope.currentCID,
        cursor: {x: -1, y:-1},
        cursor_id: _this.$scope.my_cursor_id
      });
    });

    $d.onready(() => {

      // After loading the page, hide the "Loading"
      $d.get('.shadow-block')[0].style.display = 'none';

      resizeEditor();

      // Watch the position of the cursor
      setInterval(() => {
        var pos = _this.$scope.editor.getCursorPosition();
        _this.$scope.cursorPos = 'Line ' + (pos.row+1) + ', Column ' + pos.column;
        _this.$scope.$apply();
      }, 200);

      // Send cursor update
      _this.$scope.cursor_interval = setInterval(() => {
        var pos = _this.$scope.editor.getCursorPosition();
        _this.$socket.emit('server:editor:cursor', {
          cid: _this.$scope.currentCID,
          cursor: {x: pos.row, y:pos.column},
          cursor_id: _this.$scope.my_cursor_id
        });
      }, 200);

    });

    function resizeEditor() {
      var w = window,
        d = document,
        e = d.documentElement,
        g = d.getElementsByTagName('body')[0],
        // Get the full width of the scope
        x = w.innerWidth || e.clientWidth || g.clientWidth,
        // Get the full height of the scope
        y = w.innerHeight|| e.clientHeight|| g.clientHeight,
        // Calculate the height of the editor
        editor_height = y - ($d.get('.header')[0].clientHeight + $d.get('.statusbar')[0].clientHeight);

      // Set the height of the editor
      $d.style($d.get('.editor__code')[0], { 'height' : editor_height + 'px'});

      // Set the viewing height of the example
      $d.style($d.get('#viewer')[0], { 'height' : editor_height + 'px'});
    }

  }

  drawOtherCursor(x, y) {
    var _this = this;
    var marker = {};
    marker.cursors = [{row: x, column: y}];
    marker.update = function(html, markerLayer, session, config) {
      var start = config.firstRow, end = config.lastRow;
      var cursors = this.cursors;
      for (var i = 0; i < cursors.length; i++) {
        var pos = this.cursors[i];
        if (pos.row < start) {
          continue;
        } else if (pos.row > end) {
          break;
        } else {
          // Compute cursor position on screen
          // This code is based on ace/layer/marker.js
          var screenPos = session.documentToScreenPosition(pos);

          var height = config.lineHeight;
          var width = config.characterWidth;
          var top = markerLayer.$getTop(screenPos.row, config);
          var left = markerLayer.$padding + screenPos.column * width;
          // Can add any html here
          html.push(
            "<div class='MyCursorClass' style='",
            'height: ', height, 'px; ',
            'top: ', top, 'px; ',
            'left: ', left, 'px; ',
            'width: ', width, "px;'></div>"
          );
        }
      }
    };
    marker.redraw = function() {
      this.session._signal('changeFrontMarker');
    };
    marker.addCursor = function() {
      // Add to this cursors

      // Trigger redraw
      marker.redraw();
    };
    marker.session = _this.$scope.editor.session;
    marker.session.addDynamicMarker(marker, true);
    // Call marker.session.removeMarker(marker.id) to remove it
    // Call marker.redraw after changing one of cursors
    return marker.id;
  }

  runCommand(command) {
    var _this = this;

    _this.$scope.command_show = false;
    _this.$scope.search_cmd = '';
    $d.get('.search-box input')[0].value = '';

    const position = _this.$scope.editor.getCursorPosition();
    var cmd = '';
    var val = '';

    const words = ['spongiolin', 'shamblingly', 'emend', 'chaetophoraceous', 'diplographic', 'wrist', 'plenitide', 'personalize', 'theftdom', 'unwarm', 'unbeseemingness', 'anthropotoxin', 'encroach', 'jewellike', 'unreproachingly', 'overdye', 'overbragging', 'firesafeness', 'overharsh', 'sermonproof', 'distilland', 'veri', 'aweigh', 'lamestery', 'glyptolith', 'zac', 'gorgonian', 'pseudodramatic', 'coaxer', 'preformant', 'lidder', 'Promethea', 'isomeride', 'gonidiospore', 'tilt', 'alpasotes', 'notionally', 'pawing', 'messieurs', 'hypozoan', 'machineless', 'nationalist', 'frondous', 'lackey', 'tooter', 'excelsior', 'Septoria', 'Heterochloridales', 'autoanalytic', 'foiling', 'stoun', 'pocketableness', 'dogtoothing', 'Tetum', 'fastingly', 'baniya', 'calendry', 'uroplania', 'evocate', 'badgerly', 'overstress', 'leucocratic', 'neuropathology', 'Vicki', 'executively', 'private', 'tropocaine', 'Mercurean', 'Oligocene', 'sciophyte', 'causational', 'weakishly', 'unparticipated', 'Guaque', 'bap', 'Panorpa', 'phytoecology', 'collinearly', 'Antarctica', 'embryoniform', 'itinerate', 'diol', 'glycolate', 'louchettes', 'underfootman', 'apocarpous', 'unelectable', 'somatocyst', 'saltator', 'etiolize', 'apophlegmatic', 'Sphenophyllum', 'furnacite', 'ygapo', 'Justine', 'Basuto', 'synanastomosis', 'quadrated', 'nonerudite', 'solent', 'typholysin', 'pollinar', 'litus', 'isolinolenic', 'hematoporphyrin', 'necromancy', 'luteous', 'eriophyllous', 'battologist', 'bifarious', 'simoom', 'venatic', 'tarantara', 'helodes', 'countervair', 'pseudopodia', 'uroschesis', 'benamidar', 'mucker', 'indecence', 'hydroplatinocyanic', 'wanderyear', 'agile', 'liferoot', 'glout', 'rooibok', 'Acalypha', 'plumpen', 'Tiwaz', 'ked', 'conquest', 'turricula', 'achillobursitis', 'nonsymbiotically', 'choragy', 'Gastrophilus', 'planirostral', 'indiscrete', 'repugnant', 'blindfoldedness', 'foreschool', 'auxiliatory', 'Eleutheri', 'linking', 'truantism', 'wringer', 'constructorship', 'periuranium', 'cleanse', 'fawn', 'Leptocephalus', 'restitutory', 'Quapaw', 'jolly', 'exothermous', 'sonnetwise', 'tubotympanal', 'uily', 'trickstering', 'characterological', 'paramorphine', 'purwannah', 'greenbrier', 'legislatively', 'infraradular', 'maximum', 'overtense', 'crumbly', 'uninvigorated', 'rumbustiousness', 'lactosuria', 'superstructural', 'uxorious', 'esoteric', 'unworshiped', 'Adamastor', 'metalleity', 'preposterously', 'hypocycloidal', 'Bakuninist', 'abstainment', 'unwritable', 'calycinal', 'underproduction', 'sloosh', 'coccous', 'distill', 'resatisfy', 'Luffa', 'klendusity', 'assident', 'usucapt', 'stealy', 'hyalophagia', 'Matagalpan', 'dunner', 'outcomer', 'ostracode', 'roccellic', 'Stephanian', 'postcalcarine', 'Carboniferous', 'autographically', 'oncological', 'radiculose', 'unpenetrated', 'plainsman', 'undoweled', 'billyboy', 'foreacquaint', 'boobery', 'Mopan', 'parode', 'infracostalis', 'favoress', 'toothcup', 'clipped', 'posticteric', 'morphinism', 'demonish', 'spratty', 'cynoid', 'nonbrowsing', 'bloodthirsty', 'deliveror', 'conarial', 'ceratitic', 'abaff', 'Boschneger', 'lithuresis', 'physitheistic', 'turpethin', 'kendir', 'Pythagoreanism', 'pteroma', 'unhidable', 'retter', 'indeclinably', 'nontraditional', 'sulfoacid', 'spinosotuberculate', 'slagman', 'palaeography', 'wreath', 'depasture', 'uneffeminated', 'unutterably', 'impleadable', 'snafu', 'bronchotomist', 'apodyterium', 'basically', 'nondeist', 'stadhouse', 'barbellate', 'wrothly', 'disintegratory', 'atriensis', 'piceotestaceous', 'malacopod', 'paratragoedia', 'klipspringer', 'Albanenses', 'endoplastule', 'spiteful', 'secularness', 'Amerindic', 'Doris', 'colonist', 'unredeemedness', 'epistemological', 'accessibly', 'bloodthirster', 'dirtbird', 'maioid', 'scyphiform', 'emotionless', 'waldmeister', 'unforestalled', 'anazoturia', 'Trionychoideachid', 'cytopathological', 'bootee', 'Caunos', 'verdigrisy', 'mild', 'recidivous', 'unmountainous', 'saponarin', 'semiannealed', 'tanacetin', 'angiostomize', 'phlegmatism', 'xanthodontous', 'frugalism', 'whush', 'coky', 'parodic', 'pupilate', 'threateningly', 'riddlings', 'vermiparousness', 'phalangian', 'misdispose', 'unhandy', 'aspish', 'chemicopharmaceutical', 'benzoiodohydrin', 'flexility', 'Grapsus', 'pentamerid', 'benzoid', 'taintment', 'vindicate', 'speeding', 'typonymic', 'gemless', 'execrator', 'borg', 'Tartarology', 'benzotetrazole', 'Riksmaal', 'sacrocostal', 'escort', 'fungo', 'submarinist', 'cebine', 'puntist', 'ropewalk', 'posthole', 'microdentous', 'prion', 'crumb', 'homoeomerian', 'kidnap', 'appointee', 'scary', 'vetanda', 'undermark', 'nonjudicial', 'jerseyed', 'recusancy', 'sicilicum', 'kleeneboc', 'pampsychist', 'pummel', 'Kartvelian', 'postantennal', 'squelch', 'cherishable', 'Majesta', 'spiflicated', 'dodginess', 'witnessable', 'sighful', 'connaught', 'backen', 'ginglyni', 'dissipated', 'sech', 'copple', 'inogenesis', 'Ascupart', 'Japanesquery', 'cappelenite', 'extraenteric', 'thicketed', 'areological', 'responsibleness', 'woldlike', 'scrap', 'methenamine', 'pegman', 'unsanctify', 'Dacian', 'dais', 'epiblema', 'compactedness', 'pawnbroker', 'mellow', 'moveableness', 'vorticist', 'chargeless', 'polyserositis'];
    const firstname = ['Alexandra', 'Alison', 'Amanda', 'Amelia', 'Amy', 'Andrea', 'Angela', 'Anna', 'Anne', 'Audrey', 'Ava', 'Bella', 'Bernadette', 'Carol', 'Caroline', 'Carolyn', 'Chloe', 'Claire', 'Deirdre', 'Diana', 'Diane', 'Donna', 'Dorothy', 'Elizabeth', 'Ella', 'Emily', 'Emma', 'Faith', 'Felicity', 'Fiona', 'Gabrielle', 'Grace', 'Hannah', 'Heather', 'Irene', 'Jan', 'Jane', 'Jasmine', 'Jennifer', 'Jessica', 'Joan', 'Joanne', 'Julia', 'Karen', 'Katherine', 'Kimberly', 'Kylie', 'Lauren', 'Leah', 'Lillian', 'Lily', 'Lisa', 'Madeleine', 'Maria', 'Mary', 'Megan', 'Melanie', 'Michelle', 'Molly', 'Natalie', 'Nicola', 'Olivia', 'Penelope', 'Pippa', 'Rachel', 'Rebecca', 'Rose', 'Ruth', 'Sally', 'Samantha', 'Sarah', 'Sonia', 'Sophie', 'Stephanie', 'Sue', 'Theresa', 'Tracey', 'Una', 'Vanessa', 'Victoria', 'Virginia', 'Wanda', 'Wendy', 'Yvonne', 'Zoe', 'Adrian', 'Alan', 'Alexander', 'Andrew', 'Anthony', 'Austin', 'Benjamin', 'Blake', 'Boris', 'Brandon', 'Brian', 'Cameron', 'Carl', 'Charles', 'Christian', 'Christopher', 'Colin', 'Connor', 'Dan', 'David', 'Dominic', 'Dylan', 'Edward', 'Eric', 'Evan', 'Frank', 'Gavin', 'Gordon', 'Harry', 'Ian', 'Isaac', 'Jack', 'Jacob', 'Jake', 'James', 'Jason', 'Joe', 'John', 'Jonathan', 'Joseph', 'Joshua', 'Julian', 'Justin', 'Keith', 'Kevin', 'Leonard', 'Liam', 'Lucas', 'Luke', 'Matt', 'Max', 'Michael', 'Nathan', 'Neil', 'Nicholas', 'Oliver', 'Owen', 'Paul', 'Peter', 'Phil', 'Piers', 'Richard', 'Robert', 'Ryan', 'Sam', 'Sean', 'Sebastian', 'Simon', 'Stephen', 'Steven', 'Stewart', 'Thomas', 'Tim', 'Trevor', 'Victor', 'Warren', 'William'];
    const lastname = ['Abraham', 'Allan', 'Alsop', 'Anderson', 'Arnold', 'Avery', 'Bailey', 'Baker', 'Ball', 'Bell', 'Berry', 'Black', 'Blake', 'Bond', 'Bower', 'Brown', 'Buckland', 'Burgess', 'Butler', 'Cameron', 'Campbell', 'Carr', 'Chapman', 'Churchill', 'Clark', 'Clarkson', 'Coleman', 'Cornish', 'Davidson', 'Davies', 'Dickens', 'Dowd', 'Duncan', 'Dyer', 'Edmunds', 'Ellison', 'Ferguson', 'Fisher', 'Forsyth', 'Fraser', 'Gibson', 'Gill', 'Glover', 'Graham', 'Grant', 'Gray', 'Greene', 'Hamilton', 'Hardacre', 'Harris', 'Hart', 'Hemmings', 'Henderson', 'Hill', 'Hodges', 'Howard', 'Hudson', 'Hughes', 'Hunter', 'Ince', 'Jackson', 'James', 'Johnston', 'Jones', 'Kelly', 'Kerr', 'King', 'Knox', 'Lambert', 'Langdon', 'Lawrence', 'Lee', 'Lewis', 'Lyman', 'MacDonald', 'Mackay', 'Mackenzie', 'MacLeod', 'Manning', 'Marshall', 'Martin', 'Mathis', 'May', 'McDonald', 'McLean', 'McGrath', 'Metcalfe', 'Miller', 'Mills', 'Mitchell', 'Morgan', 'Morrison', 'Murray', 'Nash', 'Newman', 'Nolan', 'North', 'Ogden', 'Oliver', 'Paige', 'Parr', 'Parsons', 'Paterson', 'Payne', 'Peake', 'Peters', 'Piper', 'Poole', 'Powell', 'Pullman', 'Quinn', 'Rampling', 'Randall', 'Rees', 'Reid', 'Roberts', 'Robertson', 'Ross', 'Russell', 'Rutherford', 'Sanderson', 'Scott', 'Sharp', 'Short', 'Simpson', 'Skinner', 'Slater', 'Smith', 'Springer', 'Stewart', 'Sutherland', 'Taylor', 'Terry', 'Thomson', 'Tucker', 'Turner', 'Underwood', 'Vance', 'Vaughan', 'Walker', 'Wallace', 'Walsh', 'Watson', 'Welch', 'White', 'Wilkins', 'Wilson', 'Wright', 'Young'];
    const lorem = [ 'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'curabitur', 'vel', 'hendrerit', 'libero', 'eleifend', 'blandit', 'nunc', 'ornare', 'odio', 'ut', 'orci', 'gravida', 'imperdiet', 'nullam', 'purus', 'lacinia', 'a', 'pretium', 'quis', 'congue', 'praesent', 'sagittis', 'laoreet', 'auctor', 'mauris', 'non', 'velit', 'eros', 'dictum', 'proin', 'accumsan', 'sapien', 'nec', 'massa', 'volutpat', 'venenatis', 'sed', 'eu', 'molestie', 'lacus', 'quisque', 'porttitor', 'ligula', 'dui', 'mollis', 'tempus', 'at', 'magna', 'vestibulum', 'turpis', 'ac', 'diam', 'tincidunt', 'id', 'condimentum', 'enim', 'sodales', 'in', 'hac', 'habitasse', 'platea', 'dictumst', 'aenean', 'neque', 'fusce', 'augue', 'leo', 'eget', 'semper', 'mattis', 'tortor', 'scelerisque', 'nulla', 'interdum', 'tellus', 'malesuada', 'rhoncus', 'porta', 'sem', 'aliquet', 'et', 'nam', 'suspendisse', 'potenti', 'vivamus', 'luctus', 'fringilla', 'erat', 'donec', 'justo', 'vehicula', 'ultricies', 'varius', 'ante', 'primis', 'faucibus', 'ultrices', 'posuere', 'cubilia', 'curae', 'etiam', 'cursus', 'aliquam', 'quam', 'dapibus', 'nisl', 'feugiat', 'egestas', 'class', 'aptent', 'taciti', 'sociosqu', 'ad', 'litora', 'torquent', 'per', 'conubia', 'nostra', 'inceptos', 'himenaeos', 'phasellus', 'nibh', 'pulvinar', 'vitae', 'urna', 'iaculis', 'lobortis', 'nisi', 'viverra', 'arcu', 'morbi', 'pellentesque', 'metus', 'commodo', 'ut', 'facilisis', 'felis', 'tristique', 'ullamcorper', 'placerat', 'aenean', 'convallis', 'sollicitudin', 'integer', 'rutrum', 'duis', 'est', 'etiam', 'bibendum', 'donec', 'pharetra', 'vulputate', 'maecenas', 'mi', 'fermentum', 'consequat', 'suscipit', 'aliquam', 'habitant', 'senectus', 'netus', 'fames', 'quisque', 'euismod', 'curabitur', 'lectus', 'elementum', 'tempor', 'risus', 'cras' ];

    if (command.indexOf('|')>=0) {
      cmd = command.split('|')[0];
      val = command.split('|')[1];
    } else {
      cmd = command;
    }

    if (cmd == 'cdnjs:search') {
      const query = prompt('Enter script name:', '');
      if (!query) {return false}

      _this.$scope.commands = [{ value: 'Loading...', cmd: '' }];
      _this.$scope.command_show = true;

      _this.$http.post(
        'https://2qwlvlxzb6-dsn.algolia.net/1/indexes/libraries/query?x-algolia-api-key=2663c73014d2e4d6d1778cc8ad9fd010&x-algolia-application-id=2QWLVLXZB6',
        {'params':'query=' + query})
        .success((data) => {
          _this.$scope.commands = [];
          const items = data.hits;
          for (var i = 0; i < items.length; i++) {
            _this.$scope.commands.push({value: items[i].name, descr: items[i].description, cmd: 'cdnjs:getversion|' + query});
          }
        });
    }

    if (cmd == 'cdnjs:getfilename') {

      _this.$scope.commands = [];
      _this.$scope.command_show = true;

      for (var i = 0; i < _this.$scope.cdnjs_files.length; i++) {
        _this.$scope.commands.push({ value: _this.$scope.cdnjs_files[i], cmd: 'cdnjs:insert|' + val + ',' + _this.$scope.cdnjs_files[i] });
      }

    }

    if (cmd == 'cdnjs:getversion') {
      _this.$scope.commands = [{ value: 'Loading...', cmd: '' }];
      _this.$scope.command_show = true;

      _this.$http.get('/lib/' + val).success((resp) => {
        _this.$scope.commands = [];
        var match = resp.match(/<option value="(.*?)"/g);
        var files = resp.match(/library-url'>(.*?)<\/p>/g);

        console.log(files);

        _this.$scope.cdnjs_files = [];

        for (let i = 0; i < files.length; i++) {
          const filename = files[i].replace('library-url\'>','').replace('</p>','');
          _this.$scope.cdnjs_files.push(filename);
        }

        for (let i = 0; i < match.length; i++) {
          var version = match[i].replace('<option value="','').replace('"','');
          _this.$scope.commands.push({value: version, cmd: 'cdnjs:getfilename|' + version});
        }

      });
    }

    if (cmd == 'cdnjs:insert') {

      const version = val.split(',')[0];
      const filename = val.split(',')[1];
      const text = '//cdnjs.cloudflare.com/ajax/libs/jquery/'+ version + '/' + filename;
      _this.$scope.editor.session.insert(position, text);

    }

    if (cmd == 'random:int') {
      const minmax = prompt('Random integer from-to:', '1,100');
      if (!minmax) {return false}
      const min = minmax.split(',')[0];
      const max = minmax.split(',')[1];
      const text = Math.floor(Math.random() * (max - min + 1) + min).toString();
      _this.$scope.editor.session.insert(position, text);
    }

    if (cmd == 'random:float') {
      const minmax = prompt('Random integer from-to:', '1,100');
      if (!minmax) {return false}
      const min = minmax.split(',')[0];
      const max = minmax.split(',')[1];
      const text = Math.random() * (max - min) + min;
      _this.$scope.editor.session.insert(position, text);
    }

    if (cmd == 'random:text') {
      var text = '';

      for (let i = 0; i < 30; i++)
      {text += words[Math.floor(Math.random() * words.length)] + ' '}

      _this.$scope.editor.session.insert(position, text.trim());
    }

    if (cmd == 'random:uuid') {
      const text = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {var r = Math.random()*16|0,v=c=='x'?r:r&0x3|0x8;return v.toString(16)});
      _this.$scope.editor.session.insert(position, text);
    }

    if (cmd == 'random:url') {
      const text = 'http'+ ((Math.round(Math.random() * 1)) > 0 ? 's' : '') +'://' + words[Math.floor(Math.random() * words.length)] + '.com/' + words[Math.floor(Math.random() * words.length)] + '/' + words[Math.floor(Math.random() * words.length)] + '?q=' + words[Math.floor(Math.random() * words.length)];
      _this.$scope.editor.session.insert(position, text);
    }

    if (cmd == 'random:email') {
      const text = words[Math.floor(Math.random() * words.length)] + '@' + words[Math.floor(Math.random() * words.length)] + '.com';
      _this.$scope.editor.session.insert(position, text);
    }

    if (cmd == 'random:firstname') {
      const text = firstname[Math.floor(Math.random() * firstname.length)];
      _this.$scope.editor.session.insert(position, text);
    }

    if (cmd == 'random:lastname') {
      const text = lastname[Math.floor(Math.random() * lastname.length)];
      _this.$scope.editor.session.insert(position, text);
    }

    if (cmd == 'random:fullname') {
      const text = firstname[Math.floor(Math.random() * firstname.length)] + ' ' + lastname[Math.floor(Math.random() * lastname.length)];
      _this.$scope.editor.session.insert(position, text);
    }

    if (cmd == 'random:hex') {
      const text = '#'+((1<<24)*Math.random()|0).toString(16);
      _this.$scope.editor.session.insert(position, text);
    }

    if (cmd == 'random:ip4') {
      const text = Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255);
      _this.$scope.editor.session.insert(position, text);
    }

    if (cmd == 'random:ip6') {
      const text = Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase();
      _this.$scope.editor.session.insert(position, text);
    }

    if (cmd == 'random:ip6') {
      const text = Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase() + ':' + Math.random().toString(36).substr(2,4).toUpperCase();
      _this.$scope.editor.session.insert(position, text);
    }

    if (cmd == 'random:letnum') {
      const text = Math.random().toString(36).substr(2, Math.random() * 30);
      _this.$scope.editor.session.insert(position, text);
    }

    if (cmd == 'random:lorem') {
      let text = '';

      for (let i = 0; i < 30; i++)
      {text += lorem[Math.floor(Math.random() * lorem.length)] + ' '}

      _this.$scope.editor.session.insert(position, text.trim());
    }

    if (cmd == 'snippet:for') {
      let text = 'for (var i = 0; i < Things.length; i++)\n{\n\tThings[i]\n}';
      _this.$scope.editor.session.insert(position, text.trim());
    }

    setTimeout(function() {
      _this.$scope.editor.focus();
    });

  }

  // Controlling the modification of the example view
  viewerShow(bool) {
    var _this = this;
    _this.$scope.codeRunned = bool;
  }

  // Brings the code to the iframe
  writeCode() {
    var _this = this;
    var iframe = document.getElementById('viewer');
    iframe = iframe.contentWindow || (iframe.contentDocument.document || iframe.contentDocument);
    iframe.document.open();
    iframe.document.write(_this.$scope.editor.getValue());
    iframe.document.close();
  }

  // Viewing the result of HTML
  runCode() {
    this.viewerShow(true);
    this.writeCode();
  }

  // Hide HTML result
  closeCode() {
    this.viewerShow(false);
  }

  // Saving code
  saveCode() {
    var _this = this;

    var arr = {
      cid: _this.$scope.currentCID,
      mode: _this.$scope.currentMode,
      code: btoa(unescape(encodeURIComponent(_this.$scope.currentCode))),
    };

    _this.$scope.isSaving = true;

    // At the time of saving, we forbid editing.
    $d.addClass($d.get('.ace_scroller')[0], 'disabled');

    // Sending changes to the server
    _this.$http.post('save' + location.pathname, arr).success((data) => {
      _this.$scope.isSaving = false;
      _this.disableEditor(false);
    });

  }

  // Prohibition of editing
  disableEditor(bool = false) {
    if (bool) {$d.addClass($d.get('.ace_scroller')[0],'disabled')} else {$d.removeClass($d.get('.ace_scroller')[0],'disabled')}
    this.$scope.editor.textInput.getElement().disabled = bool;
  }

  setCode(data) {
    var _this = this;
    _this.$scope.currentCID = data.cid;
    _this.$scope.currentMode = data.mode;
    _this.$scope.currentCode = _this.dcd64(data.code);
    _this.$scope.editor.setValue(_this.dcd64(data.code), 1);
    if (data.hasOwnProperty('viewer')) {_this.$scope.codeRunned = !!data.viewer}
    if (data.hasOwnProperty('autorun')) {_this.$scope.autoRun = !!data.autorun}

    if (_this.$scope.autoRun == true && _this.$scope.currentMode == 'html') {
      this.writeCode();
    }

    //_this.$scope.$apply();
    _this.disableEditor(true);

    clearTimeout(_this.$scope.waitEditor);

    _this.$scope.waitEditor = setTimeout(() => {
      _this.disableEditor(false);
    }, _this.$scope.saveDelay);
  }

  dcd64(c) {0<=c.indexOf('=')&&(c=c.substr(0,c.indexOf('=')));for (var k=0,d=0,b,l,e,g,f=0,a,h,m='';k<c.length;++k) {l='='==c.charAt(k)?0:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(c.charAt(k));d=(d+6)%8;if (6!=d) {b+=l>>d;if (0==f) {g=!0,h=0,e=1,128>b&&(e=0,h=b&64,g=!1)} else if (128!=(b&192)) {return !1} for (a=32;g&&0<a;a>>=1) {b&a?++e:g=!1}g||(a=6+6*f-e,6<a&&(a=6),a&&(h+=b%(1<<a)<<6*(e-f)));f==e?(m+=String.fromCharCode(h),f=0):++f}b=d?l%(1<<d)<<8-d:0} return m}

}

AppController.$inject = ['$scope', '$socket', '$http', '$sce'];
