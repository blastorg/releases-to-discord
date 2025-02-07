import core from '@actions/core'
import github from '@actions/github'
import fetch from 'node-fetch'

/**
 * Stylizes a markdown body into an appropriate embed message style.
 *  H3s converted to bold and underlined.
 *  H2s converted to bold.
 *  Redundant whitespace and newlines removed.
 * @param description
 * @returns {*}
 */
const formatDescription = (description) => {
    return description
        .replace(/### (.*?)\n/g, function (substring) {
            const newString = substring.slice(4).replace(/(\r\n|\n|\r)/gm, '')
            return `**__${newString}__**`
        })
        .replace(/## (.*?)\n/g, function (substring) {
            const newString = substring.slice(3).replace(/(\r\n|\n|\r)/gm, '')
            return `**${newString}**`
        })
        .replace(/\n\s*\n/g, '\n')
}

/**
 * Get the context of the action, returns a GitHub Release payload.
 * @returns {Promise<{html_url, body: (*|string), version: string}>}
 */
async function getContext(releasePayload) {
    return {
        body:
            releasePayload.body.length < 1500
                ? releasePayload.body
                : releasePayload.body.substring(0, 1500) +
                  ` ([...](${releasePayload.html_url}))`,
        version: releasePayload.tag_name,
        html_url: releasePayload.html_url,
    }
}

/**
 * Handles the action.
 * Get inputs, creates a stylized response webhook, and sends it to the channel.
 * @returns {Promise<void>}
 */
async function run() {
    const webhookUrl = core.getInput('webhook_url')
    const color = core.getInput('color')
    const username = core.getInput('username')
    const avatarUrl = core.getInput('avatar_url')
    const tag_name = core.getInput('release_tag_name')
    const github_token = core.getInput('github_token')

    if (!webhookUrl)
        return core.setFailed('webhook_url not set. Please set it.')

    let releasePayload

    if (tag_name) {
        if (!github_token)
            return core.setFailed(
                'tag_name manually specified but github_token not provided. Token is required to fetch releases manually'
            )

        core.info(`Manually fetching release ${tag_name}`)

        const octokit = github.getOctokit(github_token)

        // You can also pass in additional options as a second parameter to getOctokit
        // const octokit = github.getOctokit(myToken, {userAgent: "MyActionVersion1"});

        ;({ data: releasePayload } = await octokit.rest.repos.getReleaseByTag({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            tag: tag_name,
        }))
    } else {
        core.info('Using release from initiating webhook')
        releasePayload = github.context.payload.release
    }

    const { body, html_url, version } = await getContext(releasePayload)

    const description = formatDescription(body)

    const embedMsg = {
        title: `Release ${version}`,
        url: html_url,
        color: color,
        description: description,
    }

    const requestBody = {
        username: username,
        avatar_url: avatarUrl,
        embeds: [embedMsg],
    }

    const url = `${webhookUrl}?wait=true`
    fetch(url, {
        method: 'post',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
    })
        .then((res) => res.json())
        .then((data) => core.info(JSON.stringify(data)))
        .catch((err) => core.info(err))
}

run()
    .then(() => {
        core.info('Action completed successfully')
    })
    .catch((err) => {
        core.setFailed(err.message)
    })
