
"use strict";

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

var codeMirrorConfig = {
    styleActiveLine: true,
    lineNumbers: true,
    indentUnit: 4
};

var err       = {
    _: 'Failed to load library',
    404: 'Library not found',
    403: 'Forbidden access for library file',
    500: 'Internal server error. Please try again in a few minutes'
}

var editor = CodeMirror($('#editor').get(0), codeMirrorConfig);
var result = CodeMirror($('#result').get(0), codeMirrorConfig);

editor.on('change', function(codemirror, change) {
    result.setValue(UnderBasic.compile(codemirror.getValue()).content);
});
