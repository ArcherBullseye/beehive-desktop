import React, { useState, useEffect } from 'react';
import { createAndSendRawTransaction, getFee } from '../../../../lib/sapi';
import { isAddress, isPK } from '../../../../lib/smart';
import style from './SendForm.module.css';
import { useForm } from 'react-hook-form';
import useModal from '../../../../util/useModal';
import Modal from '../modal/Modal';
import barcode from '../../../../assets/images/barcode.svg';
import useDebounce from '../../../../util/useDebounce';

function Send({ address, balance, privateKey, withdraw }) {
    const { isShowing, toggle } = useModal(false);
    const [amount, setAmount] = useState();
    const [txid, setTxId] = useState();
    const [fee, setFee] = useState();
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState();
    const debouncedAmount = useDebounce(amount, 1000);
    const [sendAllFunds, setSendAllFunds] = useState(false);

    const { register, handleSubmit, errors, setError, setValue, formState, triggerValidation, getValues } = useForm({
        mode: 'onChange',
        defaultValues: {
            amount: withdraw ? Number(balance - 0.002).toFixed(8) : null,
        },
    });

    useEffect(() => {
        if (debouncedAmount) {
            getFeeFromSAPI(debouncedAmount);
        }
    }, [debouncedAmount]);

    const onSubmit = (data) => {
        setLoading(true);
        createAndSendRawTransaction(data?.addressTo, Number(data?.amount), String(privateKey || data?.privateKey))
            .then((data) => setTxId(data?.txid))
            .catch((error) => setError(error[0]?.message))
            .finally(() => setLoading(false));
    };

    const getFeeFromSAPI = (amount) => {
        getFee(Number(amount), address).then((fee) => {
            setFee(fee);
            // if (fee && Number(getValues("amount")) + fee > balance) {
            //   setError("amount", "invalid", "Requested amount exceeds balance");
            // }
        });
    };

    const handleSendAllFunds = async (sendAllFunds) => {
        if (sendAllFunds) {
            const amount = Number(getValues('amount')) - 0.001;
            setValue('amount', amount, true);
            await triggerValidation('amount').then((data) => data && setAmount(amount));
        }
        setSendAllFunds(false);
    }

    if (txid) {
        return (
            <div className={style.amountWasSent}>
                <p>Amount has been sent</p>
                <a href={`https://insight.smartcash.cc/tx/${txid}`} target="_blank" rel="noopener noreferrer">
                    {txid}
                    <small>(click to view details)</small>
                </a>
                <button onClick={() => window.location.reload()}>Refresh Page</button>
            </div>
        );
    }

    return (
        <>
            <form onSubmit={handleSubmit(onSubmit)} className="formGroup" autoComplete="off">
                <div className="formControl">
                    <label>
                        Address to send
                        <input
                            type="text"
                            name="addressTo"
                            ref={register({
                                required: true,
                                validate: async (value) => {
                                    let isValid = false;
                                    await isAddress(value)
                                        .then((data) => {
                                            isValid = true;
                                        })
                                        .catch((error) => {
                                            setError('addressTo', 'invalid', 'Invalid address');
                                        });
                                    return isValid;
                                },
                            })}
                            onInput={() => triggerValidation('addressTo')}
                        />
                    </label>
                    <button
                        type="button"
                        className="modalButton"
                        onClick={() => {
                            toggle();
                            setType('address');
                        }}
                    >
                        <img className="barCode" src={barcode} alt="Barcode" />
                    </button>
                    {errors.addressTo && <span className="error-message">{errors.addressTo.message}</span>}
                </div>
                <div className="formControl">
                    <label>
                        Amount to send
                        <input
                            type="text"
                            name="amount"
                            ref={register({
                                required: true,
                                validate: (value) => {
                                    setSendAllFunds(false);
                                    if (value >= balance) {
                                        setSendAllFunds(true);
                                        setError('amount', 'invalid', 'Exceeds balance');
                                        return false;
                                    }
                                    if (value < 0.001) {
                                        setError('amount', 'invalid', 'The minimum amount to send is 0.001');
                                        return false;
                                    }
                                    if (!value.match(/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:((\.)\d{0,8})+)?$/)) {
                                        setError('amount', 'invalid', 'Invalid format. e.g. 0,000.00000000');
                                        return false;
                                    }
                                },
                            })}
                            onInput={async (e) => {
                                const amountValue = e?.target?.value.replace(',', '');
                                await triggerValidation('amount').then((data) => data && setAmount(amountValue));
                            }}
                        />
                    </label>
                    {errors.amount && <span className="error-message">{errors.amount.message}</span>}
                </div>
                {
                    sendAllFunds && (
                        <div className={style.sendFundsMessage}>
                            <p>Send all your funds?</p>
                            <button onClick={() => handleSendAllFunds(true)}>Yes</button>
                            <button onClick={() => handleSendAllFunds(false)}>No</button>
                        </div>
                    )
                }
                {fee && (
                    <div className={style.fee}>
                        <p>Fee: {fee}</p>
                        <p className={style.requestedAmount}>Requested Amount: {Number(Number(getValues('amount').replace(',', '')) + fee).toFixed(8)}</p>
                    </div>
                )}
                {!privateKey ? (
                    <div className="formControl">
                        <label>
                            Your Private Key
                            <input
                                type="text"
                                name="privateKey"
                                defaultValue={privateKey}
                                ref={register({
                                    required: true,
                                    validate: async (value) => {
                                        let isValid = false;
                                        await isPK(value)
                                            .then((data) => (isValid = true))
                                            .catch((error) => {
                                                setError('privateKey', 'invalid', 'Invalid Private Key');
                                            });
                                        return isValid;
                                    },
                                })}
                            />
                        </label>
                        <button
                            type="button"
                            className="modalButton"
                            onClick={() => {
                                toggle();
                                setType('privateKey');
                            }}
                        >
                            <img className="barCode" src={barcode} alt="Barcode" />
                        </button>
                        {errors.privateKey && <span className="error-message">{errors.privateKey.message}</span>}
                    </div>
                ) : null}
                <button type="submit" disabled={loading || !formState.isValid}>
                    Send
                </button>
            </form>
            <Modal
                isShowing={isShowing}
                hide={toggle}
                callback={(obj) => {
                    if (type === 'address') {
                        obj.address && setValue('addressTo', obj.address, true);
                        obj.amount && setValue('amount', obj.amount, true);
                    }
                    if (type === 'privateKey') {
                        obj.address && setValue('privateKey', obj.address, true);
                    }
                }}
            />
        </>
    );
}

export default Send;
