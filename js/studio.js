
"use strict";

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

var codeMirrorConfig = {
    styleActiveLine: true,
    lineNumbers: true,
    indentUnit: 4
};

var editor = CodeMirror($('#editor').get(0), codeMirrorConfig);
var result = CodeMirror($('#result').get(0), codeMirrorConfig);

editor.on('change', function(codemirror, change) {
    var comp = UnderBasic.compile(codemirror.getValue());
    $('#result').css('border-color', comp.failed ? 'red' : 'lightgray');
    result.setValue(comp.content);
});
