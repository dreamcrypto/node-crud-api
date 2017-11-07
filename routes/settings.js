const express = require('express')
const { createClient } = require('contentful')
const { getSpace } = require('./../services/contentful')
const { catchErrors } = require('../handlers/errorHandlers')
const router = express.Router()

async function renderSettings (res, opts) {
  // Get connectred space to display the space name on top of the settings
  let space = false
  try {
    space = await getSpace()
  } catch (error) {
    console.error(error)
  }

  res.render('settings', {
    title: 'Settings',
    errors: {},
    hasErrors: false,
    success: false,
    space,
    ...opts
  })
}

/* GET settings page. */
router.get('/', catchErrors(async function (req, res, next) {
  const { settings } = res.locals
  await renderSettings(res, {
    settings
  })
}))

/* POST settings page. */
router.post('/', catchErrors(async function (req, res, next) {
  const errorList = []
  const { space, cda, cpa, editorialFeatures } = req.body
  const settings = {
    space,
    cda,
    cpa,
    editorialFeatures: !!editorialFeatures
  }

  // Validate required fields.
  if (!space) {
    errorList.push({
      field: 'space',
      message: 'This field is required'
    })
  }

  if (!cda) {
    errorList.push({
      field: 'cda',
      message: 'This field is required'
    })
  }

  if (!cpa) {
    errorList.push({
      field: 'cpa',
      message: 'This field is required'
    })
  }

  // Validate space and CDA access token.
  if (space && cda) {
    try {
      await createClient({
        space,
        accessToken: cda
      }).getSpace()
    } catch (err) {
      if (err.response.status === 401) {
        errorList.push({
          field: 'cda',
          message: 'Your Delivery API key is invalid.'
        })
      } else if (err.response.status === 404) {
        errorList.push({
          field: 'space',
          message: 'This space does not exist.'
        })
      } else {
        errorList.push({
          field: 'cda',
          message: `Something went wrong: ${err.response.data.message}`
        })
      }
    }
  }

  // Validate space and CPA access token.
  if (space && cpa) {
    try {
      await createClient({
        space,
        accessToken: cpa,
        host: 'preview.contentful.com'
      }).getSpace()
    } catch (err) {
      if (err.response.status === 401) {
        errorList.push({
          field: 'cpa',
          message: 'Your Preview API key is invalid.'
        })
      } else if (err.response.status === 404) {
        // Already validated via CDA
      } else {
        errorList.push({
          field: 'cpa',
          message: `Something went wrong: ${err.response.data.message}`
        })
      }
    }
  }

  if (!errorList.length) {
    res.cookie('theExampleAppSettings', settings, { maxAge: 31536000, httpOnly: true })
  }

  // Generate error dictionary
  // Format: { FIELD_NAME: [array, of, error, messages] }
  const errors = errorList.reduce((errors, error) => {
    return {
      ...errors,
      [error.field]: [
        ...(errors[error.field] || []),
        error.message
      ]
    }
  }, {})

  await renderSettings(res, {
    settings,
    errors,
    hasErrors: errorList.length > 0,
    success: errorList.length === 0
  })
}))

module.exports = router
