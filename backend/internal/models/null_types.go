package models

import (
	"database/sql"
	"encoding/json"
	"time"
)

// NullString handles proper JSON marshaling for sql.NullString
type NullString struct {
	sql.NullString
}

func (ns NullString) MarshalJSON() ([]byte, error) {
	if !ns.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(ns.String)
}

func (ns *NullString) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		ns.Valid = false
		return nil
	}
	
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	
	ns.String = s
	ns.Valid = true
	return nil
}

// NullBool handles proper JSON marshaling for sql.NullBool
type NullBool struct {
	sql.NullBool
}

func (nb NullBool) MarshalJSON() ([]byte, error) {
	if !nb.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(nb.Bool)
}

func (nb *NullBool) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		nb.Valid = false
		return nil
	}
	
	var b bool
	if err := json.Unmarshal(data, &b); err != nil {
		return err
	}
	
	nb.Bool = b
	nb.Valid = true
	return nil
}

// NullTime handles proper JSON marshaling for sql.NullTime
type NullTime struct {
	sql.NullTime
}

func (nt NullTime) MarshalJSON() ([]byte, error) {
	if !nt.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(nt.Time)
}

func (nt *NullTime) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		nt.Valid = false
		return nil
	}
	
	var t time.Time
	if err := json.Unmarshal(data, &t); err != nil {
		return err
	}
	
	nt.Time = t
	nt.Valid = true
	return nil
}

// NullInt64 handles proper JSON marshaling for sql.NullInt64
type NullInt64 struct {
	sql.NullInt64
}

func (ni NullInt64) MarshalJSON() ([]byte, error) {
	if !ni.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(ni.Int64)
}

func (ni *NullInt64) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		ni.Valid = false
		return nil
	}
	
	var i int64
	if err := json.Unmarshal(data, &i); err != nil {
		return err
	}
	
	ni.Int64 = i
	ni.Valid = true
	return nil
}