'use strict'

import * as vscode from 'vscode'
import { query, load } from './query'
import { cache } from './cache'
import { AxiosResponse } from 'axios';

let loadingStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
loadingStatus.text = 'Loading Snippet ...'

// Query string that was executed (not escaped)
var currQuery = null
// Answer number that was shown
var currNum = 0
// Current state of comments (for toggleComments)
var verboseState = true

export function activate(ctx: vscode.ExtensionContext) {
    cache.state = ctx.globalState

    // Required for toggleComments
    let configuration = vscode.workspace.getConfiguration('snippet')
    verboseState = configuration["verbose"]

    ctx.subscriptions.push(vscode.commands.registerCommand(
        'snippet.find', find))
    ctx.subscriptions.push(vscode.commands.registerCommand(
        'snippet.findInplace', findInplace))
    ctx.subscriptions.push(vscode.commands.registerCommand(
        'snippet.findInNewEditor', findInNewEditor))
    ctx.subscriptions.push(vscode.commands.registerCommand(
        'snippet.findSelectedText', findSelectedText))
    ctx.subscriptions.push(vscode.commands.registerCommand(
        'snippet.showPreviousAnswer', showPreviousAnswer))
    ctx.subscriptions.push(vscode.commands.registerCommand(
        'snippet.showNextAnswer', showNextAnswer))
    ctx.subscriptions.push(vscode.commands.registerCommand(
        'snippet.toggleComments', toggleComments))
}

function getLanguage(): string {
    let language: string = null
    let editor = vscode.window.activeTextEditor
    let configuration = vscode.workspace.getConfiguration('snippet')
    if (!editor) {
        let defaultLanguage: string = configuration['defaultLanguage']
        if (!defaultLanguage || !defaultLanguage.trim() || !configuration.openInNewEditor) {
            vscode.window.showErrorMessage('There is no open editor window');
            return
        }
        language = defaultLanguage
    } else {
        language = editor.document.languageId
    }
    return language
}

function getConfig(param: string) {
    let configuration = vscode.workspace.getConfiguration('snippet')
    return configuration[param]
}

async function loadSnippet(): Promise<AxiosResponse> {
    let language = getLanguage()
    currQuery = await query(language)
    loadingStatus.show()
    let response = await load(currQuery, 0, getConfig("verbose"), language)
    loadingStatus.hide()
    return response
}

async function find() {
    let response = await loadSnippet()
    showSnippet(response.data, getLanguage(), getConfig("openInNewEditor"))
}

async function findInplace() {
    let configuration = vscode.workspace.getConfiguration('snippet')
    let language = getLanguage()
    currQuery = await query(language)
    loadingStatus.show()
    let verbose: boolean = configuration["verbose"]
    let response = await load(currQuery, 0, verbose, language)
    loadingStatus.hide()
    showSnippet(response.data, language, false)
}

async function findInNewEditor() {
    let configuration = vscode.workspace.getConfiguration('snippet')
    let language = getLanguage()
    currQuery = await query(language)
    loadingStatus.show()
    let verbose: boolean = configuration["verbose"]
    let response = await load(currQuery, 0, verbose, language)
    loadingStatus.hide()
    showSnippet(response.data, language, true)
}

async function showNextAnswer() {
    if (!currQuery) {
        await find()
        return
    }
    let editor = vscode.window.activeTextEditor
    if (!editor) {
        vscode.window.showErrorMessage('There is no open editor window');
        return
    }

    let language = editor.document.languageId

    let configuration = vscode.workspace.getConfiguration('snippet')
    let openInNewEditor: boolean = configuration["openInNewEditor"]

    currNum += 1;

    let verbose: boolean = configuration["verbose"]
    loadingStatus.show()
    let response = await load(currQuery, currNum, verbose, language)
    loadingStatus.hide()
    showSnippet(response.data, language, openInNewEditor)
}

async function showPreviousAnswer() {
    if (!currQuery) {
        await find()
        return
    }
    let editor = vscode.window.activeTextEditor
    if (!editor) {
        vscode.window.showErrorMessage('There is no open editor window');
        return
    }

    let language = editor.document.languageId

    let configuration = vscode.workspace.getConfiguration('snippet')
    let openInNewEditor: boolean = configuration["openInNewEditor"]

    if (currNum > 0) {
        currNum -= 1;
    }
    let verbose: boolean = configuration["verbose"]

    let response = await load(currQuery, currNum, verbose, language)
    showSnippet(response.data, language, openInNewEditor)
}

async function toggleComments() {
    let editor = vscode.window.activeTextEditor
    if (!editor) {
        vscode.window.showErrorMessage('There is no open editor window');
        return
    }

    let language = editor.document.languageId

    let configuration = vscode.workspace.getConfiguration('snippet')
    let openInNewEditor: boolean = configuration["openInNewEditor"]
    verboseState = !verboseState

    let response = await load(currQuery, currNum, verboseState, language)
    showSnippet(response.data, language, openInNewEditor)
}

async function findSelectedText() {
    let editor = vscode.window.activeTextEditor
    if (!editor) {
        vscode.window.showErrorMessage('There is no open editor window');
        return
    }

    let language = editor.document.languageId

    let selection = editor.selection;
    let query = editor.document.getText(selection);

    let configuration = vscode.workspace.getConfiguration('snippet')
    let openInNewEditor: boolean = configuration["openInNewEditor"]
    let verbose: boolean = configuration["verbose"]

    let response = await load(query, 0, verbose, language)
    showSnippet(response.data, language, openInNewEditor)
}

async function showSnippet(content: string, language: string, openInNewEditor = true) {
    if (openInNewEditor) {
        let document = await vscode.workspace.openTextDocument({ language, content })
        vscode.window.showTextDocument(document, vscode.ViewColumn.Two)
        return
    }

    let editor = vscode.window.activeTextEditor
    if (!editor) {
        let document = await vscode.workspace.openTextDocument({ language, content })
        vscode.window.showTextDocument(document, vscode.ViewColumn.Two)
    }
    editor.edit(
        edit => editor.selections.forEach(
            selection => {
                edit.insert(selection.end, "\n" + content);
            }
        )
    );
}