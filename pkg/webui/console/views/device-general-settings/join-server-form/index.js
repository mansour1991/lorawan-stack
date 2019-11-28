// Copyright © 2019 The Things Network Foundation, The Things Industries B.V.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React from 'react'

import SubmitButton from '../../../../components/submit-button'
import SubmitBar from '../../../../components/submit-bar'
import Input from '../../../../components/input'
import Checkbox from '../../../../components/checkbox'
import Form from '../../../../components/form'

import diff from '../../../../lib/diff'
import m from '../../../components/device-data-form/messages'
import PropTypes from '../../../../lib/prop-types'
import sharedMessages from '../../../../lib/shared-messages'

import { parseLorawanMacVersion, hasExternalJs } from '../utils'
import validationSchema from './validation-schema'

// The Join Server can store end device fields while not exposing the root keys. This means
// that the `root_keys` object is present while `root_keys.nwk_key` == nil or `root_keys.app_key == nil`
// must hold. See https://github.com/TheThingsNetwork/lorawan-stack/issues/1473
const isNwkKeyHidden = ({ root_keys }) =>
  Boolean(root_keys) &&
  typeof root_keys.nwk_key === 'object' &&
  Object.keys(root_keys.nwk_key).length === 0
const isAppKeyHidden = ({ root_keys }) =>
  Boolean(root_keys) &&
  typeof root_keys.app_key === 'object' &&
  Object.keys(root_keys.app_key).length === 0

const JoinServerForm = React.memo(props => {
  const { device, onSubmit } = props

  const isNewLorawanVersion = parseLorawanMacVersion(device.lorawan_version) >= 110

  // Setup and memoize initial reducer state.
  const initialState = React.useMemo(() => {
    const { resets_join_nonces: resetsJoinNonces = false } = device
    const externalJs = hasExternalJs(device)

    return {
      resetsJoinNonces,
      externalJs,
    }
  }, [device])
  const [resetsJoinNonces, setResetsJoinNonces] = React.useState(initialState.resetsJoinNonces)
  const [externalJs, setExternalJs] = React.useState(initialState.externalJs)

  // Setup and memoize initial form state.
  const initialValues = React.useMemo(
    () =>
      validationSchema.cast(device, {
        context: {
          externalJs: hasExternalJs(device),
          lorawanVersion: device.lorawan_version,
        },
      }),
    [device],
  )

  // Setup and memoize callbacks for changes to `resets_join_nonces` and `_external_js`.
  const handleResetsJoinNoncesChange = React.useCallback(() => {
    setResetsJoinNonces(externalJs ? false : resetsJoinNonces)
  }, [externalJs, resetsJoinNonces])
  // Note: If the end device is provisioned on an external JS, we reset `root_keys` and
  // `resets_join_nonces` fields.
  const handleExternalJsChange = React.useCallback(
    evt => {
      setExternalJs(!externalJs)

      const { checked: externalJsChecked } = evt.target
      const { setValues } = formRef.current

      setValues(
        validationSchema.cast(initialValues, {
          context: { externalJs: externalJsChecked, lorawanVersion: device.lorawan_version },
        }),
      )
    },
    [initialValues, externalJs, device],
  )

  const formRef = React.useRef(null)
  const [error, setError] = React.useState('')

  const onFormSubmit = React.useCallback(
    async (values, { setSubmitting, resetForm }) => {
      const castedValues = validationSchema.cast(values, {
        context: { externalJs, lorawanVersion: device.lorawan_version },
      })
      const updatedValues = diff(initialValues, castedValues, ['_external_js', '_lorawan_version'])

      setError('')
      try {
        await onSubmit(updatedValues)
        resetForm(castedValues)
      } catch (err) {
        setSubmitting(false)
        setError(err)
      }
    },
    [initialValues, onSubmit, externalJs, device],
  )

  const validate = React.useCallback(
    () =>
      validationSchema.validate({
        context: { externalJs, lorawanVersion: device.lorawan_version },
      }),
    [externalJs, device],
  )

  const nwkKeyHidden = isNwkKeyHidden(device)
  const appKeyHidden = isAppKeyHidden(device)

  let appKeyPlaceholder = m.leaveBlankPlaceholder
  if (externalJs) {
    appKeyPlaceholder = sharedMessages.provisionedOnExternalJoinServer
  } else if (appKeyHidden) {
    appKeyPlaceholder = m.unexposed
  }

  let nwkKeyPlaceholder = m.leaveBlankPlaceholder
  if (externalJs) {
    nwkKeyPlaceholder = sharedMessages.provisionedOnExternalJoinServer
  } else if (nwkKeyHidden) {
    nwkKeyPlaceholder = m.unexposed
  }

  return (
    <Form
      validate={validate}
      initialValues={initialValues}
      onSubmit={onFormSubmit}
      formikRef={formRef}
      error={error}
      enableReinitialize
    >
      <Form.Field
        title={m.externalJoinServer}
        description={m.externalJoinServerDescription}
        name="_external_js"
        onChange={handleExternalJsChange}
        component={Checkbox}
      />
      <Form.Field
        title={sharedMessages.joinServerAddress}
        placeholder={externalJs ? m.external : sharedMessages.addressPlaceholder}
        name="join_server_address"
        component={Input}
        disabled={externalJs}
        required
      />
      <Form.Field
        title={m.netID}
        description={m.netIDDescription}
        name="net_id"
        type="byte"
        min={3}
        max={3}
        component={Input}
        disabled={externalJs}
      />
      <Form.Field
        title={sharedMessages.appKey}
        name="root_keys.app_key.key"
        type="byte"
        min={16}
        max={16}
        placeholder={appKeyPlaceholder}
        description={m.appKeyDescription}
        component={Input}
        disabled={externalJs || appKeyHidden}
        required
      />
      {isNewLorawanVersion && (
        <Form.Field
          title={sharedMessages.nwkKey}
          name="root_keys.nwk_key.key"
          type="byte"
          min={16}
          max={16}
          placeholder={nwkKeyPlaceholder}
          description={m.nwkKeyDescription}
          component={Input}
          disabled={externalJs || nwkKeyHidden}
          required
        />
      )}
      {isNewLorawanVersion && (
        <Form.Field
          title={m.resetsJoinNonces}
          onChange={handleResetsJoinNoncesChange}
          warning={resetsJoinNonces ? m.resetWarning : undefined}
          name="resets_join_nonces"
          component={Checkbox}
          disabled={externalJs}
        />
      )}
      <SubmitBar>
        <Form.Submit component={SubmitButton} message={sharedMessages.saveChanges} />
      </SubmitBar>
    </Form>
  )
})

JoinServerForm.propTypes = {
  device: PropTypes.device.isRequired,
  onSubmit: PropTypes.func.isRequired,
}

export default JoinServerForm
