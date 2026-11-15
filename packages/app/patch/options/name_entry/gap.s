// 名前入力の升目で、5 字ごとに隙間を空ける。
// 表は 1 行 15 升で、5 列目と 10 列目の後ろに {name_gap} ドットの隙間を入れる。
// 隙間 2 つぶんは、桁幅を求める name_pitch（grid.s）が枠幅から先に引いている。
// 升目もカーソルも列の番号を持ち回らないため、どちらも割り算で求め直す

// 升目を描くループで、次の升の位置へ進める
org $CCBB65
	JSL name_step
	NOP
	NOP
	NOP
	NOP
	NOP
	NOP

// カーソルの横の位置。原版は「列 × 桁幅 + 余白」
org $CCBA77
	JSL name_cursor_x
	NOP
	NOP
	NOP
	NOP
	NOP

org {hook_name_gap}

// Y はウィンドウの情報、X は表の次の添字を指す。
// 今描いた升の番号は「X ÷ 2 - 1」で、1 行の升数で割った余りが列になる
name_step:
	PHX
	TXA
	LSR
	db $3A			// DEC A
	STA $4204
	SEP #$20
	db $B9,$2E,$00		// LDA $002E,Y。1 行の升数
	STA $4206
	REP #$20
	JSR name_wait
	LDA $4216		// 列
	PLX
	CMP #$0004
	BEQ name_step_gap
	CMP #$0009
	BEQ name_step_gap
	LDA #$0000
	BRA name_step_add
name_step_gap:
	LDA #{name_gap}
name_step_add:
	CLC
	db $79,$32,$00		// ADC $0032,Y。桁幅
	CLC
	db $79,$00,$00		// ADC $0000,Y。今の位置
	db $99,$00,$00		// STA $0000,Y
	RTL

// A は枠の左端、X はウィンドウの情報を指す。
// 原版の「列 × 桁幅」は乗算器に残っているが、列は残らないので、カーソル ÷ 1 行の升数で求め直す
name_cursor_x:
	CLC
	ADC $4216		// 列 × 桁幅
	db $7D,$0A,$00		// ADC $000A,X。左の余白
	PHA
	db $BD,$36,$00		// LDA $0036,X。カーソル
	STA $4204
	SEP #$20
	db $BD,$2E,$00		// LDA $002E,X。1 行の升数
	STA $4206
	REP #$20
	JSR name_wait
	LDA $4216		// 列
	CMP #$0005
	BCC name_cursor_none
	CMP #$000A
	BCC name_cursor_one
	LDA #{name_gap}
	CLC
	ADC #{name_gap}
	BRA name_cursor_add
name_cursor_one:
	LDA #{name_gap}
	BRA name_cursor_add
name_cursor_none:
	LDA #$0000
name_cursor_add:
	CLC
	db $63,$01		// ADC $01,S
	db $83,$01		// STA $01,S
	PLA
	db $85,$02		// STA $02
	RTL

// 除算器は書き込みから 16 サイクルで答えが出る。JSR と RTS で 12、NOP 2 つで 4 待つ
name_wait:
	NOP
	NOP
	RTS
warnpc {hook_name_gap}+$100
