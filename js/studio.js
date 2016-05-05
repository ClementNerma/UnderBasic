
"use strict";

function filesClickEvent() {
    $('#files div.file').click(function() {
        var fileName = $(this).text();

        if(fileName === currentFile)
            return ;

        files[currentFile] = editor.getValue();
        currentFile        = fileName;
        editor.setValue(files[currentFile]);
    });
}

var localStorageSupport = (typeof localStorage !== 'undefined'),
    autoSaved,
    currentFile = 'main',
    files = {
        main: ''
    };

var underbasicConfig = {
    localize: true,
    //localizeCamelCase: true,
    checkVariablesName: true,
    //checkAssignments: true
    // DISABLED because this feature is still experimental
};

var editor = CodeMirror($('#editor').get(0), {
    styleActiveLine: true,
    lineNumbers: true,
    indentUnit: 2,
    mode: 'python'
});

var result = CodeMirror($('#result').get(0), {
    styleActiveLine: true,
    lineNumbers: true,
    indentUnit: 2,
    mode: 'basic'
});

editor.on('change', function(codemirror, change) {
    var code = codemirror.getValue();

    if(localStorageSupport) {
        files[currentFile] = code;
        localStorage.setItem('__underbasic_autosave', JSON.stringify(files));
        localStorage.setItem('__underbasic_current_file', currentFile);
    }

    underbasicConfig.files = files;
    var comp = UnderBasic.compile(code, underbasicConfig), mode = comp.failed ? 'text' : 'basic';
    $('#result').css('border-color', comp.failed ? 'red' : 'lightgray');
    if(result.options.mode !== mode) result.setOption('mode', mode);
    result.setValue(comp.content);
    window.comp = comp;
});

if(localStorageSupport && (autoSaved = localStorage.getItem('__underbasic_autosave'))) {
    var conf;

    try {
        files       = JSON.parse(autoSaved);
        currentFile = localStorage.getItem('__underbasic_current_file') || 'main';

        if(conf = localStorage.getItem('__underbasic_config'))
            underbasicConfig = JSON.parse(conf);
        console.info('Auto-saved content has been restored, current file is "' + currentFile + '"');
    }

    catch(e) {
        alert('Unable to recover last auto-save. Auto-save will be erased and page will be refreshed');
        localStorage.removeItem('__underbasic_autosave');
        localStorage.removeItem('__underbasic_current_file');
        window.location.reload();
    }

    for(var i in files)
        if(files.hasOwnProperty(i))
            $('#files').append($(document.createElement('div')).text(i).attr('name', i).addClass('file').addClass(currentFile === i ? 'active' : ''));

    editor.setValue(files[currentFile]);
} else {
    if(localStorageSupport) {
        try {
            localStorage.getItem('__underbasic_config', JSON.stringify(underbasicConfig));
            localStorage.setItem('__underbasic_autosave', JSON.stringify(files));
            localStorage.setItem('__underbasic_current_file', currentFile);
        }

        catch(e) {
            alert('Unable to save configuration. You might have the following message the next time you will launch this page :\n"Unable to recover last auto-save"\nDon\'t be worry if you see it.')
        }
    }

    $('#files').append('<div class="file active">main</div>');
}

$('#addFile').on('click', function() {
    var name = prompt('Please input the file name :');

    if(files.hasOwnProperty(name))
        return alert('This file already exists !');

    files[name] = '';

    $('#files').append($(document.createElement('div')).addClass('file').text(name).attr('name', name));
    filesClickEvent();
    $('#files [name="' + name + '"]').click();

    editor.focus();

});

$('#deleteFile').on('click', function() {
    var name = prompt('Please input the file name :');

    if(name === 'main')
        return alert('You can\'t delete the "main" file !');

    if(!files.hasOwnProperty(name))
        return alert('This file doesn\'t exists !');

    $('#files [name="main"]').click();
    $('#files [name="' + name + '"]').remove();
    delete files[name];
});

$('#options').on('click', function() {
    var optionsNames = Object.keys(underbasicConfig);
    var option = prompt('Please input the option name :\n\n' + optionsNames.join('\n'));

    if(!option)
        return ;

    if(optionsNames.indexOf(option) === -1)
        return alert('Bad option name');

    var value = prompt('Please input the new value of the option (type "[exit]" to cancel)\nCurrent value :\n\n' + underbasicConfig[option]);

    if(value !== '[exit]') {
        underbasicConfig[option] = value;

        if(localStorageSupport)
            localStorage.setItem('__underbasic_config', JSON.stringify(underbasicConfig));
    }
});

filesClickEvent();

editor.focus();
