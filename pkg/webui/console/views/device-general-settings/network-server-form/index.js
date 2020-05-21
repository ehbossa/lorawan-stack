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

import SubmitButton from '@ttn-lw/components/submit-button'
import SubmitBar from '@ttn-lw/components/submit-bar'
import Checkbox from '@ttn-lw/components/checkbox'
import Input from '@ttn-lw/components/input'
import Radio from '@ttn-lw/components/radio-button'
import Select from '@ttn-lw/components/select'
import Form from '@ttn-lw/components/form'
import Notification from '@ttn-lw/components/notification'

import m from '@console/components/device-data-form/messages'

import { NsFrequencyPlansSelect } from '@console/containers/freq-plans-select'
import DevAddrInput from '@console/containers/dev-addr-input'

import diff from '@ttn-lw/lib/diff'
import sharedMessages from '@ttn-lw/lib/shared-messages'
import PropTypes from '@ttn-lw/lib/prop-types'

import {
  parseLorawanMacVersion,
  ACTIVATION_MODES,
  LORAWAN_VERSIONS,
  LORAWAN_PHY_VERSIONS,
  generate16BytesKey,
} from '@console/lib/device-utils'

import messages from '../messages'
import {
  isDeviceABP,
  isDeviceMulticast,
  hasExternalJs,
  isDeviceJoined,
  isDeviceOTAA,
} from '../utils'

import validationSchema from './validation-schema'

const NetworkServerForm = React.memo(props => {
  const { device, onSubmit, onSubmitSuccess, mayEditKeys, mayReadKeys } = props

  const isABP = isDeviceABP(device)
  const isMulticast = isDeviceMulticast(device)
  const isJoinedOTAA = isDeviceOTAA(device) && isDeviceJoined(device)

  const formRef = React.useRef(null)

  const [error, setError] = React.useState('')
  const [resetsFCnt, setResetsFCnt] = React.useState(
    (isABP && device.mac_settings && device.mac_settings.resets_f_cnt) || false,
  )
  const [lorawanVersion, setLorawanVersion] = React.useState(
    parseLorawanMacVersion(device.lorawan_version),
  )

  const initialValues = React.useMemo(() => {
    const { multicast = false, supports_join = false } = device

    let _activation_mode = ACTIVATION_MODES.ABP
    if (supports_join) {
      _activation_mode = ACTIVATION_MODES.OTAA
    } else if (multicast) {
      _activation_mode = ACTIVATION_MODES.MULTICAST
    }

    const values = {
      ...device,
      _activation_mode,
      _external_js: hasExternalJs(device) && mayReadKeys,
      _joined: isDeviceOTAA(device) && isDeviceJoined(device),
      _may_edit_keys: mayEditKeys,
      _may_read_keys: mayReadKeys,
    }

    return validationSchema.cast(values)
  }, [device, mayEditKeys, mayReadKeys])

  const onFormSubmit = React.useCallback(
    async (values, { resetForm, setSubmitting }) => {
      const castedValues = validationSchema.cast(values)
      const updatedValues = diff(initialValues, castedValues, [
        '_activation_mode',
        '_external_js',
        '_joined',
        '_may_edit_keys',
        '_may_read_keys',
      ])

      setError('')
      try {
        await onSubmit(updatedValues)
        resetForm(castedValues)
        onSubmitSuccess()
      } catch (err) {
        setSubmitting(false)
        setError(err)
      }
    },
    [initialValues, onSubmit, onSubmitSuccess],
  )

  const handleResetsFCntChange = React.useCallback(evt => {
    const { checked } = evt.target

    setResetsFCnt(checked)
  }, [])

  const handleVersionChange = React.useCallback(
    version => {
      const isABP = initialValues._activation_mode === ACTIVATION_MODES.ABP
      const lwVersion = parseLorawanMacVersion(version)
      setLorawanVersion(lwVersion)
      const { setValues, state: formState } = formRef.current
      const { session = {} } = formState.values
      const { session: initialSession } = initialValues
      if (lwVersion >= 110) {
        const updatedSession = isABP
          ? {
              dev_addr: session.dev_addr,
              keys: {
                ...session.keys,
                s_nwk_s_int_key:
                  session.keys.s_nwk_s_int_key || initialSession.keys.s_nwk_s_int_key,
                nwk_s_enc_key: session.keys.nwk_s_enc_key || initialSession.keys.nwk_s_enc_key,
              },
            }
          : session
        setValues({
          ...formState.values,
          lorawan_version: version,
          session: updatedSession,
        })
      } else {
        const updatedSession = isABP
          ? {
              dev_addr: session.dev_addr,
              keys: {
                f_nwk_s_int_key: session.keys.f_nwk_s_int_key,
              },
            }
          : session
        setValues({
          ...formState.values,
          lorawan_version: version,
          session: updatedSession,
        })
      }
    },
    [initialValues],
  )

  // Notify the user that the session keys might be there, but since there are
  // no rights to read the keys we cannot display them.
  const showResetNotification = !mayReadKeys && mayEditKeys && !Boolean(device.session)

  return (
    <Form
      validationSchema={validationSchema}
      initialValues={initialValues}
      onSubmit={onFormSubmit}
      error={error}
      formikRef={formRef}
      enableReinitialize
    >
      <Form.Field
        title={sharedMessages.macVersion}
        description={m.lorawanVersionDescription}
        name="lorawan_version"
        component={Select}
        required
        options={LORAWAN_VERSIONS}
        onChange={handleVersionChange}
      />
      <Form.Field
        title={sharedMessages.phyVersion}
        description={m.lorawanPhyVersionDescription}
        name="lorawan_phy_version"
        component={Select}
        required
        options={LORAWAN_PHY_VERSIONS}
      />
      <NsFrequencyPlansSelect name="frequency_plan_id" required />
      <Form.Field title={m.supportsClassC} name="supports_class_c" component={Checkbox} />
      <Form.Field
        title={m.activationMode}
        disabled
        required
        name="_activation_mode"
        component={Radio.Group}
        horizontal={false}
      >
        <Radio label={m.otaa} value={ACTIVATION_MODES.OTAA} />
        <Radio label={m.abp} value={ACTIVATION_MODES.ABP} />
        <Radio label={m.multicast} value={ACTIVATION_MODES.MULTICAST} />
      </Form.Field>
      {(isABP || isMulticast || isJoinedOTAA) && (
        <>
          {!isMulticast && !isJoinedOTAA && (
            <Form.Field
              title={m.resetsFCnt}
              onChange={handleResetsFCntChange}
              warning={resetsFCnt ? m.resetWarning : undefined}
              name="mac_settings.resets_f_cnt"
              component={Checkbox}
            />
          )}
          {showResetNotification && <Notification content={messages.keysResetWarning} info small />}
          <DevAddrInput
            title={sharedMessages.devAddr}
            name="session.dev_addr"
            placeholder={m.leaveBlankPlaceholder}
            description={m.deviceAddrDescription}
            disabled={!mayEditKeys}
            required={mayReadKeys && mayEditKeys}
          />
          <Form.Field
            title={lorawanVersion >= 110 ? sharedMessages.fNwkSIntKey : sharedMessages.nwkSKey}
            name="session.keys.f_nwk_s_int_key.key"
            type="byte"
            min={16}
            max={16}
            description={lorawanVersion >= 110 ? m.fNwkSIntKeyDescription : m.nwkSKeyDescription}
            disabled={!mayEditKeys}
            component={Input.Generate}
            mayGenerateValue={mayEditKeys}
            onGenerateValue={generate16BytesKey}
          />
          {lorawanVersion >= 110 && (
            <Form.Field
              title={sharedMessages.sNwkSIKey}
              name="session.keys.s_nwk_s_int_key.key"
              type="byte"
              min={16}
              max={16}
              description={m.sNwkSIKeyDescription}
              disabled={!mayEditKeys}
              component={Input.Generate}
              mayGenerateValue={mayEditKeys}
              onGenerateValue={generate16BytesKey}
            />
          )}
          {lorawanVersion >= 110 && (
            <Form.Field
              title={sharedMessages.nwkSEncKey}
              name="session.keys.nwk_s_enc_key.key"
              type="byte"
              min={16}
              max={16}
              description={m.nwkSEncKeyDescription}
              disabled={!mayEditKeys}
              component={Input.Generate}
              mayGenerateValue={mayEditKeys}
              onGenerateValue={generate16BytesKey}
            />
          )}
        </>
      )}
      <SubmitBar>
        <Form.Submit component={SubmitButton} message={sharedMessages.saveChanges} />
      </SubmitBar>
    </Form>
  )
})

NetworkServerForm.propTypes = {
  device: PropTypes.device.isRequired,
  mayEditKeys: PropTypes.bool.isRequired,
  mayReadKeys: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onSubmitSuccess: PropTypes.func.isRequired,
}

export default NetworkServerForm
