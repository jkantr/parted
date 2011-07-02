var parted = require('../')
  , assert = require('assert')
  , fs = require('fs')
  , path = require('path');

var test = fs.readFileSync(__dirname + '/test.txt');
var boundary = test.toString('utf8')
                   .match(/^--[^\r\n]+/)[0].slice(2);

var files = path.normalize(__dirname + '/tmp');
if (!path.existsSync(files)) {
  fs.mkdirSync(files, 0666);
} else {
  fs.readdirSync(files).forEach(function(f) {
    fs.unlink(files + '/' + f);
  });
}
parted.root = files;

// create a mock request
var request = function(size) {
  var stream = fs.createReadStream(__dirname + '/test.txt', { 
    bufferSize: size 
  });
  return {
    headers: {
      'content-type': 'multipart/form-data; boundary="' + boundary + '"'
    },
    pipe: function(dest) {
      stream.pipe(dest);
    },
    emit: function(ev, err) {
      if (ev === 'error') this.errback && this.errback(err);
      return this;
    },
    on: function(ev, func) {
      if (ev === 'error') this.errback = func;
      return this;
    },
    destroy: function() {
      stream.destroy();
      return this;
    }
  };
};

var message = function(size, func) {
  var req = request(size);
  parted(req, function() {
    console.log('Buffer size:', size);
    console.log(req.parts);

    assert.ok(!!req.parts, 'No parts.');
    assert.ok(!!req.parts.content, 'No file path.');
    assert.ok(req.parts.text === 'hello', 
              'Bad text. Got: ' + req.parts.text);
    assert.ok(req.parts.hello === 'world...oh look the end'
              + ' of the part: \r\n------WebKi-just kidding', 
              'Bad text. Got: ' + req.parts.hello);

    var got = fs.readFileSync(req.parts.content)
      , expect = test.slice(233, 495) 
      , i = 0
      , len = expect.length;

    assert.ok(got.length === len, 
      'Sizes not equal.' 
      + ' Expected: ' + len 
      + '. Got: ' + got.length + '.'
    );

    for (; i < len; i++) {
      assert.ok(got[i] === expect[i], 'Diff failure.');
    }

    console.log('Parts parsed successfully.');

    if (func) func();
  });
};

var multiple = function() {
  var times = 100;

  (function next(i) {
    if (!i) return done();
    message(i, function() {
      next(--i);
    });
  })(times);

  function done() {
    console.log('Completed, no errors.');
  }
};

multiple();