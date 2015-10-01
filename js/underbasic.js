
"use strict";

var libErr = {
    _  : 'Failed to load library',
    404: 'Library not found',
    403: 'Forbidden access for library file',
    500: 'Internal server error. Please try again in a few minutes'
};

var libraries = {};
var keyWords = ['function'];

var UnderBasic = new (function() {

    var _langs = {}, _lang = 'en';

    this.translate = function(str, parameters, obj) {
        if(!_langs.hasOwnProperty(_lang))
            return str;

        if(obj && !_langs[_lang].hasOwnProperty(obj))
            return str;

        return (!obj ? (_langs[_lang][str] || str) : (_langs[_lang][obj][str] || str))
                .replace(/([^\\])\{\{(.*?)\}\}/g, function(match, pre, content) {
                    return parameters.hasOwnProperty(content) ? pre + parameters[content] : pre + content;
                });
    };

    this.translation = function(lang) {
        if(!_langs.hasOwnProperty(lang)) {
            var req = $.ajax({
                method: 'GET',
                cache: false,
                url: 'lang/' + lang + '.tpk',
                timeout: 10000,
                dataType: 'text',
                async: false
            });

            if(req.status !== 200) {
                console.error('Failed to load translation pack "' + lang + '" : ' + libErr[req.status]);
                return false;
            }

            _langs[lang] = JSON.parse(req.responseText);
        }

        _lang = lang;
        console.info('"' + lang + '" language set');
        return true;
    }

    this.type = function(content, extended, celtic3) {

        var v = this.variable(content, extended, celtic3);

        if(v)
            return v;

        if(content.match(/^([0-9\.\+\-\*\/\(\)\!]+)$/))
            return 'number';

        if(content.match(/^"(.*)"$/))
            return 'string';

        if(content.match(/^{(.*)}$/))
            return 'list';

        if(content.match(/^\[([0-9,\[\]A-Z\*\+\-\/\.]+)\]$/))
            return 'matrix';

    };

    this.variable = function(varname, extended, celtic3) {

        if(varname.match(/^Str([0-9])$/))
            return 'string';

        if(varname.match(/^[A-Z]$/))
            return 'number';

        if(varname.match(/^L([A-Z]){1,6}$/))
            return 'list';

        if(varname.match(/^L([A-Z]){1,6}\[([A-Z0-9]+)\]$/))
            return 'number';

        if(varname.match(/^\[([A-Z])\]$/))
            return 'matrix';

        if(varname.match(/^\[([A-Z])\]\(([A-Z0-9]+),([A-Z0-9]+)\)$/))
            return 'number';

        if(varname.match(/^Y[0-9]$/))
            return 'yvar';

        if(varname.match(/^Pic[0-9]$/))
            return 'picture';

        if(varname.match(/^GDB[0-9]$/))
            return 'GDB';

        if(!extended)
            return false;

        if(varname.match(/^prgm([A-Z]{1,8})$/))
            return 'program';

        if(!celtic3)
            return false;

        if(varname.match(/^appv([A-Z]{1,8})$/))
            return 'appvar';

        if(varname.match(/^group([A-Z]{1,8})$/))
            return 'group';

        if(varname.match(/^app([A-Za-z0-9]{1,8})$/))
            return 'application';

    };

    this.compile = function(code, options) {

        var started = (new Date()).getTime();
        var notices = [];

        options = options || {};
        options.files = options.files || {};

        var lines = code.split('\n'),
            match, line,
            alias = {}, functions = {};

        code = code
            .replace(/([^\\])\/\*(.*)\*\//mg, '$1')
            .replace(/([^\\])\/\/(.*)$/mg, '$1');

        var includedLibs = [];

        code = code.replace(/(^|\n)#include( *)([a-zA-Z0-9_\-,\.]+)(\n|$)/g, function(match, a, b, file, c) {
            if(!options.files.hasOwnProperty(file))
                return '\n#&' + tr('Can\'t include file "{{file}}" : File not found', {file: file}) + '&#\n';

            return a + files[file] + c;
        });

        code = code.replace(/(^|\n)#library( *)([a-zA-Z0-9_]+)(\n|$)/g, function(match, a, b, lib, c) {
            if(includedLibs.indexOf(lib) !== -1) {
                notices.push('Library "{{lib}}" has been already loaded',{lib:lib});
                return a || c; // can't include two times a library !
            }

            if(!libraries.hasOwnProperty(lib)) {
                var req = $.ajax({
                    method: 'GET',
                    cache: false,
                    url: 'libs/' + lib + '.ubl',
                    timeout: 10000,
                    dataType: 'text',
                    async: false
                });

                if(req.status !== 200)
                    return '\n#&' + tr('Failed to load library "{{lib}}" : {{status}}', {lib:lib,status:libErr[req.status]}) + '&#\n';

                libraries[lib] = req.responseText;
            }

            includedLibs.push(lib);
            return a + libraries[lib] + c;
        });

        for(var i = 0; i < lines.length; i += 1) {
            line = lines[i];

            if(match = line.match(/^(#def|#define|#alias|)( *)([a-zA-Z0-9_]+)( *):( *)([a-zA-Z0-9_]+)$/)) {
                alias[match[3]] = match[6];
                code = code.replace(new RegExp('(\\b)' + escapeRegExp(match[3]) + '(\\b)', 'g'), match[6]);
            }
        }

        code = code
            .replace(/^(.*)$/mg, function(match, content) { return content.trim(); })
            .replace(/^(#def|#define|#alias|)( *)([a-zA-Z0-9_]+)( *):( *)([a-zA-Z0-9_]+)$/mg, '')
            .replace(/^([a-zA-Z0-9]+)( *)\(( *)(.*)( *)\)$/mg, function(match, func, a, b, args) {
                if(keyWords.indexOf(func.toLocaleLowerCase()) !== -1)
                    return match;

                return func + ' ' + args;
            });

        code  = code
            .replace(/(^|\n)function( *)([a-zA-Z0-9_]+)( *)\(([a-zA-Z0-9_, =\*\[\]"]*)\)( *){\n((.|\n)*?)\n}(\n|$)/g, function(match, a, b, name, c, argsS, d, content) {

                name = options.localize ? (options.localizeCamelCase ? tr(name, {}, 'functions').replace(/([a-z])([A-Z])/g, function(match, min, maj) {
                    return min + '_' + maj.toLocaleLowerCase();
                }) : tr(name, {}, 'functions')) : name;

                if(functions.hasOwnProperty(name))
                    return '\n#&' + tr('Can\'t redeclare function "{{name}}"', {name:name}) + '&#\n';

                if(typeof functions[name] !== 'undefined')
                    return '\n#&' + tr('"{{name}}" is an object-reserved keyword', {name:name}) + '&#\n';

                if(keyWords.indexOf(name) !== -1)
                    return '\n#&' + tr('"{{name}}" is a reserved keyword', {name:name}) + '&#\n';

                if(UnderBasic.variable(name))
                    return '\n#&' + tr('"{{name}}" is a variable-reserved name', {name:name}) + '&#\n';

                var args = [], arg, m;
                argsS = argsS.trim().match(/("[^"]+"|[^,]+)/g) || [];

                for(var i = 0; i < argsS.length; i += 1) {
                    arg = argsS[i].trim();

                    m = arg.match(/^(string|number|list|matrix|yvar|picture|GDB|program|appvar|group|application|)( *)(\*|)(\[|)([a-zA-Z0-9_]+)(\]|)( *)(=|)(.*?)$/);

                    args.push({
                        type     : m[1] || false,
                        pointer  : m[3] || false,
                        optional : m[4] || false,
                        name     : m[5],
                        byDefault: m[8] ? m[9].trim() : false
                    });

                }

                functions[name] = {
                    args: args,
                    content: content.trim()
                };

                return '';
            });

        var regExp, foundFunction = true;

        while(foundFunction) {
            foundFunction = false;

            for(var i in functions) {
                if(functions.hasOwnProperty(i)) {
                    regExp = new RegExp('^' + i + '( ){1,}(.*?)$', 'mg');

                    code = code.replace(regExp, function(match, a, argsS) {
                            var realArgs = [];
                            argsS = argsS.trim().match(/("[^"]+"|[^,]+)/g) || [];

                            var args = {}, e;

                            for(var j = 0; j < functions[i].args.length; j += 1) {
                                e = functions[i].args[j];

                                if(!argsS[j]) {
                                    if(!e.optional)
                                        return '\n#&' + tr('Missing argument "{{name}}" for function "{{func}}"',{name:e.name,func:i}) + '&#\n';

                                    args[e.name] = e.byDefault || '';
                                } else {
                                    realArgs.push(e.name);
                                    args[e.name] = argsS[j].replace(/([^"]+)|("(?:[^"\\]|\\.)+")/g, function($0, $1, $2) {
                                        return $1 ? $1.replace(/\s/g, '') : $2;
                                    });

                                    if(e.pointer && !UnderBasic.variable(args[e.name], true))
                                        return '\n#&' + tr('Invalid argument [{{func}}:{{name}}] : Must be a pointer', {func:i,name:e.name}) + '&#\n';

                                    if(e.type && UnderBasic.type(args[e.name], true) !== e.type)
                                        return '\n#&' + tr('Invalid argument [{{func}}:{{name}}] : Must be a {{type}}, {{specified}} specified', {
                                            func: i,
                                            name: e.name,
                                            type: tr(e.type),
                                            specified: tr(UnderBasic.type(args[e.name], true) || 'unknown')
                                        }) + '&#\n';
                                    }
                            }

                            foundFunction = true;

                            return functions[i]
                                .content
                                .replace(/(^|\n)#unquote( *)([a-zA-Z0-9_;]+)(\n|$)/g, function(match, a, b, names, c) {
                                    names = names.split(';');

                                    for(var i = 0; i < names.length; i += 1)
                                        if(args[names[i]])
                                            args[names[i]] = args[names[i]].replace(/^"(.*)"$/, '$1');

                                    return a || c;
                                })
                                .replace(/(^|\n)#ifdef( *)([a-zA-Z0-9_]+)\n((.|\n)*?)\n#endif(\n|$)/g, function(match, a, b, name, content, c) {
                                    c = c == '}' ? '' : c;
                                    return (realArgs.indexOf(name) !== -1) ? a + content + c : a || c;
                                })
                                .replace(/(^|\n)#ifndef( *)([a-zA-Z0-9_]+)\n((.|\n)*?)\n#endifn(\n|$)/g, function(match, a, b, name, content, c) {
                                    c = c == '}' ? '' : c;
                                    return (realArgs.indexOf(name) === -1) ? a + content + c : a || c;
                                })
                                .replace(/([^\\])\{\{([a-zA-Z0-9_]+)\}\}/g, function(match, pre, varname) {
                                    varname = varname.trim();
                                    return args[varname] ? pre + args[varname] : match;
                                });
                    });
                }
            }
        }

        // the next line ignore for exemple 'suite[i] = suite[i-2]+suite[i-1]' !!!
        code = code.replace(/^([A-Z0-9\[\]\(\)]+)( *)=( *)(.*?)$/gm, function(match, varName, a, b, value) {
            if(options.checkVariablesValidName)
                if(!UnderBasic.variable(varName, true, true))
                    return '\n#&' + tr('Bad variable name : "{{name}}"', {name:varName}) + '&#\n';

            if(options.checkAssignments) {
                var varType = varType ? tr(UnderBasic.variable(varName)) : undefined;
                var valType = valType ? tr(UnderBasic.type(value, true, true)) : undefined;

                if((varType && valType) || options.ignoreUndefinedAssignment) {
                    if(!varType)
                        return '\n#&' + tr('Bad variable assignment : "{{name}}" is not a valid variable name', {name:varName}) + '&#\n';

                    if(!valType)
                        return '\n#&' + tr('Bad variable assignment : {{value}} is not a valid value', {value:value}) + '&#\n';


                    if(varType !== valType)
                        return '\n#&' + tr('Bad variable assignment : "{{name}}"\'s type is {{varType}} but assigned value\'s type is {{valType}}', {name:varName,varType:varType,valType:valType}) + '&#\n';
                } else if(!options.ignoreUndefinedAssignment) {
                    notices.push('Assignment checker was enabled but an assignment was ignored : ' + (!varType ? 'variable' : 'value') + ' type is unknown');
                }
            }

            return value + '->' + varName;
        });

        var description = code.match(/(^|\n)#description( *)(.{1,16})(\n|$)/);
        var icon        = code.match(/(^|\n)#icon( *)([A-Z0-9]{16})(\n|$)/);

        if(icon)
            code = ':' + icon[3] + '\n' + code;

        if(description)
            code = ':"' + description[3] + '\n' + code;

        code = code
            .replace(/^\\( *)(.*)$/mg, '$2')
            .replace(/^\n{1,}/g, '')
            .replace(/\n{1,}$/g, '');

        while(code.match(/\n\n/))
            code = code.replace(/\n\n/g, '\n');

        match = code.match(/(^|\n)#&(.*)&#(\n|$)/gm);
        var err;

        if(match) {
            err = tr('Compilation aborted') + ' :';
            for(var i = 0; i < match.length; i += 1)
                err += '\n    ' + match[i].match(/(^|\n)#&(.*)&#(\n|$)/)[2];
        }

        return {
            content: err || code,
            duration: (new Date()).getTime() - started,
            failed: !!err,
            notices: notices
        };

    };

});

var tr = UnderBasic.translate;
var langs = {};

var language = 'fr';

UnderBasic.translation(navigator.userLanguage || navigator.language || 'en');
