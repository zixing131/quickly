import {BaseFile} from './basefile'
import * as templates from './templates'
import * as babel from 'babel-core'

export class JSFile extends BaseFile {
    header = templates.header
    postHeader = templates.postHeader
    footer = ''
    globals = []

    get importedGlobals() {
        const globals = {}

        for (const dependency of this.dependencies) {
            for (const name of Object.keys(dependency.exportedGlobals)) {
                globals[name] = dependency.exportedGlobals[name]
            }
        }

        return globals
    }

    get exportedGlobals() {
        const globals = this.importedGlobals

        for (const name of this.globals) {
            globals[name] = this
        }

        return globals
    }

    transform() {
        if (this.qmlify.useBabel) {
            this.text = babel.transform(this.text, this.qmlify.babelOptions).code
        }

        this.postHeader = this.postHeader.replace('FILENAME', this.basename)

        this.transformRequires()
        this.findAndExportGlobals()

        this.text = this.text.trim()
        this.header = this.header.trim()
        this.postHeader = this.postHeader.trim()
        this.footer = this.footer.trim()

        if (this.postHeader)
            this.text = this.postHeader + '\n\n' + this.text
        if (this.header)
            this.text = this.header + '\n\n' + this.text
        if (this.footer)
            this.text += '\n\n' + this.footer

        this.text += '\n'
    }

    transformRequires() {
        this.text = this.text.replace(templates.requireAs, (...args) => {
            return this.replaceRequire(...args)
        })

        this.text = this.text.replace(templates.requireSideEffects, (match, $1, ...args) => {
            this.replaceRequire(match, $1, null, ...args)
            return ''
        })

        this.text = this.text.replace(templates.require, (match, $1, ...args) => {
            return this.replaceRequire(match, $1, null, ...args)
        })

        while (this.text.includes('\n\n\n'))
            this.text = this.text.replace('\n\n\n', '\n\n')
    }

    findAndExportGlobals() {
        const regex = /global\.([\w\d_]+)/g
        let match = null

        while ((match = regex.exec(this.text)) !== null) {
            const name = match[1]

            if (!this.globals.includes(name))
                this.globals.push(name)
        }

        for (const name of this.globals) {
            this.footer += `var ${name} = global.${name};\n`
        }
    }

    replaceRequire(match, $1, $2) {
        const [importPath, importAs] = $2 ? [$2, $1] : [$1, null]

        const dependency = this.require(importPath)

        const qualifier = dependency.qualifier(importAs)
        const requireStatement = dependency.requireStatement(qualifier)

        this.header += dependency.importStatement(qualifier) + '\n'

        if (importAs) {
            return `var ${importAs} = ${requireStatement};`
        } else {
            return requireStatement
        }
    }

    addGlobals() {

    }
}
