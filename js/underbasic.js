
"use strict";

var libraries = {};
var keyWords = ['function'];

var UnderBasic = new (function() {

    this.type = function(content, extended, celtic3) {

        var v = this.variable(content, extended, celtic3);

        if(v)
            return v;

        if(content.match(/^([0-9\.\+\-\*\/\(\)]+)$/))
            return 'number';

        if(content.match(/^"(.*)"$/))
            return 'string';

        if(content.match(/^{(.*)}$/))
            return 'list';

    };

    this.variable = function(varname, extended, celtic3) {

        if(varname.match(/^Str([0-9])$/))
            return 'string';

        if(varname.match(/^[A-Z]$/))
            return 'number';

        if(varname.match(/^List([A-Z]){1,6}$/))
            return 'list';

        if(varname.match(/^\[([A-Z])\]$/))
            return 'matrix';

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

    this.compile = function(code) {

        var started = (new Date()).getTime();

        var lines = code.split('\n'),
            match, line,
            alias = {}, functions = {};

        code = code.replace(/#library( *)([a-zA-Z0-9_]+)/g, function(match, a, lib) {
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
                    return '';

                libraries[lib] = req.responseText;
            }

            return libraries[lib];
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
            .replace(/(^|\n)function( *)([a-zA-Z0-9_]+)( *)\(([a-zA-Z0-9_, \*]*)\)( *){\n((.|\n)*?)\n}(\n|$)/g, function(match, a, b, name, c, argsS, d, content) {
                var args = [], arg, m;
                argsS = argsS.trim().match(/("[^"]+"|[^,]+)/g) || [];

                for(var i = 0; i < argsS.length; i += 1) {
                    arg = argsS[i].trim();

                    m = arg.match(/^(string|number|list|matrix|yvar|picture|GDB|program|appvar|group|application|)( *)(\*|)([a-zA-Z0-9_]+)$/);

                    args.push({
                        type   : m[1] || false,
                        pointer: m[3] || false,
                        name   : m[4]
                    });

                }

                functions[name] = {
                    args: args,
                    content: content.trim()
                };

                return '';
            });

        for(var i in functions) {
            if(functions.hasOwnProperty(i)) {
                code = code.replace(new RegExp('(^|\n)' + i + '( ){1,}(.*?)(\n|$)', 'g'), function(match, a, b, argsS, c) {
                        argsS = argsS.trim().match(/("[^"]+"|[^,]+)/g) || [];

                        if(argsS.length !== functions[i].args.length)
                            return '\n#&Bad number or arguments for function ' + i + ' : ' + functions[i].args.length + ' required, but ' + argsS.length + ' specified&#\n';

                        var args = {}, e;

                        for(var j = 0; j < functions[i].args.length; j += 1) {
                            e = functions[i].args[j];

                            if(!argsS[j])
                                return '\n#&Missing argument ' + e.name + ' for function ' + i;

                            args[e.name] = argsS[j].replace(/([^"]+)|("(?:[^"\\]|\\.)+")/g, function($0, $1, $2) {
                                return $1 ? $1.replace(/\s/g, '') : $2;

                                /*if ($1) {
                                    return $1.replace(/\s/g, '');
                                } else {
                                    return $2;
                                }*/
                            });

                            if(e.pointer && !UnderBasic.variable(args[e.name], true))
                                return '\n#&Invalid argument [' + i + ':' + e.name + '] : Must be a pointer&#\n';

                            if(e.type && UnderBasic.type(args[e.name], true) !== e.type)
                                return '\n#&Invalid argument [' + i + ':' + e.name + '] : Must be a ' + e.type + ', ' + (UnderBasic.type(args[e.name], true) || 'unknown') + ' specified&#\n';
                        }

                        return a + functions[i].content.replace(/([^\\])\{\{([a-zA-Z0-9_]+)\}\}/g, function(match, pre, varname) {
                            varname = varname.trim();
                            return args[varname] ? pre + args[varname] : match;
                        }) + c;
                    });
            }
        }

        var description = code.match(/(^|\n)#description( *)(.{1,16})(\n|$)/);
        var icon        = code.match(/(^|\n)#icon( *)([A-Z0-9]{16})(\n|$)/);

        if(icon)
            code = ':' + icon[3] + '\n' + code;

        if(description)
            code = ':"' + description[3] + '\n' + code;

        code = code
            .replace(/#tib( *)(.*)/g, '$2')
            .replace(/^\n{1,}/g, '')
            .replace(/\n{1,}$/g, '');

        while(code.match(/\n\n/))
            code = code.replace(/\n\n/g, '\n');

        match = code.match(/(^|\n)#&(.*)&#(\n|$)/gm);
        var err;

        if(match) {
            err = 'Compilation aborted :';
            for(var i = 0; i < match.length; i += 1)
                err += '\n    ' + match[i].match(/(^|\n)#&(.*)&#(\n|$)/)[2];
        }

        return {
            content: err || code,
            duration: (new Date()).getTime() - started,
            failed: !!err
        };

    };

});
