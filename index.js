let github = require('@actions/github')
let core = require('@actions/core')
const { ShortcutClient } = require('@useshortcut/client');

let pattern = /(?:\[|\/)(?:(?:sc-?)|(?:ch))(\d+)(?:\]|\/)/g
function matchStories(str){
  let result = []
  str = str || ''
  const matches = str.matchAll(pattern)
  for (const match of matches) {
    result.push(match[1])
  }
  return result
}

async function main () {
  try {
    const githubToken = core.getInput('GITHUB_TOKEN')
    const shortcutToken = core.getInput('SHORTCUT_TOKEN')
    const comment = core.getInput('comment')
    const client = new github.getOctokit(githubToken)
    const shortcut = new ShortcutClient(shortcutToken);

    const issue = await client.rest.pulls.get({
      ...github.context.repo,
      pull_number: github.context.payload.pull_request.number
    });

    const comments = await client.rest.issues.listComments({
      ...github.context.repo,
      issue_number: github.context.payload.pull_request.number
    });
    let stories = new Set([
      ...matchStories(issue.data.title),
      ...matchStories(issue.data.body),
      ...matchStories(issue.data.head.ref),
      ...comments.data.flatMap(c => matchStories(c.body))
    ]);

    console.log(stories);
    if (core.getInput('removePreviousComments').toLowerCase() === 'true') {
      Promise.all(Array.from(stories).flatMap(async id => {
        let story = await shortcut.getStory(id)
        return story.data.comments
            .filter(x => x.external_id.startsWith('pr' + github.context.payload.pull_request.number + '-'))
            .map(x => shortcut.deleteStoryComment(id, x.id))
      }))
    }

    if (comment) {
      Promise.all(Array.from(stories).map(x =>
          shortcut.createStoryComment(x, {
            external_id: 'pr' + github.context.payload.pull_request.number + '-' + Date.now(),
            text: comment
          })
      ));
    }

  } catch (e) {
    core.setFailed(e.message)
  }
}

main();
